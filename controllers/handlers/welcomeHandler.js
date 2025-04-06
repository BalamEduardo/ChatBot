/**
 * Manejador de comandos de bienvenida e inicio de conversación
 */
const { formatearFecha, crearFechaConZonaHoraria, obtenerDiaSemana, formatearHora } = require('../../utils/dateUtils');
const { enviarMensaje } = require('../messageHandler');
const { obtenerCitaActivaPorTelefono } = require('../../database/db');
const { limpiarTimeout } = require('../../utils/timeoutManager');
const { 
    getConversacion, 
    setConversacion, 
    deleteConversacion,
    recuperarConversacionInactiva,
    deleteConversacionInactiva,
    guardarConversacionInactiva
} = require('../../utils/flowManager');
const { 
    getMensajeBienvenida, 
    getMensajeError 
} = require('../../utils/responseUtils');
const { generarResumenCita } = require('../../utils/resumenUtils');

/**
 * Maneja el comando "hola" para iniciar o reiniciar una conversación
 * @param {string} numero - Número de teléfono del usuario
 * @returns {Promise<Object>} - Resultado de la operación
 */
async function handleHola(numero) {
    try {
        // Limpiar cualquier conversación existente o timeout previo
        limpiarTimeout(numero);
        deleteConversacion(numero);
        deleteConversacionInactiva(numero);
        
        console.log(`🔄 Usuario ${numero} (re)inicia flujo con "hola"`);
        
        // Verificar si el usuario tiene una cita activa
        const citaActiva = await obtenerCitaActivaPorTelefono(numero);

        if (citaActiva) {
            console.log(`👤 Usuario ${numero} tiene cita activa: ${JSON.stringify(citaActiva)}`);
            console.log(`💾 Fecha original de BD: ${citaActiva.fecha}`);
            
            try {
                // Preparar datos de la cita para mostrar
                const fechaObj = crearFechaConZonaHoraria(citaActiva.fecha);
                console.log(`📅 Objeto fecha convertido:`, fechaObj);
                
                const fecha = formatearFecha(fechaObj);
                console.log(`📅 Fecha formateada: ${fecha}`);
                
                const diaSemana = obtenerDiaSemana(citaActiva.fecha);
                console.log(`📅 Día semana: ${diaSemana}`);
                
                const horaFormateada = formatearHora(citaActiva.hora);
                console.log(`🕒 Hora formateada: ${horaFormateada}`);
                
                // Mostrar bienvenida personalizada con la cita existente
                const resumen = `👋 ¡Hola! Soy tu asistente virtual para citas médicas.

🧾 Tienes la siguiente cita registrada:
📅 ${diaSemana} ${fecha}
🕒 ${horaFormateada}
📌 Motivo: ${citaActiva.motivo}

¿Qué te gustaría hacer?
1️⃣ Reagendar esta cita
2️⃣ Agendar una nueva
3️⃣ Cancelar la cita
4️⃣ Salir`;

                // Guardar estado con la cita activa
                setConversacion(numero, {
                    paso: 'menu_cita_existente',
                    citaActiva
                });

                await enviarMensaje(numero, resumen);
                return { status: "cita_existente_mostrada" };
            } catch (error) {
                console.error("❌ Error formateando fecha/hora:", error);
                await enviarMensaje(numero, getMensajeError('fecha'));
                return { status: "error" };
            }
        } else {
            // Si NO hay cita previa, inicio de flujo normal
            console.log(`🆕 Iniciando flujo normal para ${numero}`);
            setConversacion(numero, { paso: 1 });

            await enviarMensaje(numero, getMensajeBienvenida());
            return { status: "bienvenida_enviada" };
        }
    } catch (error) {
        console.error("❌ Error en handleHola:", error);
        await enviarMensaje(numero, getMensajeError('general'));
        return { status: "error" };
    }
}

/**
 * Maneja el comando "continuar" para retomar una conversación inactiva
 * @param {string} numero - Número de teléfono del usuario
 * @returns {Promise<Object>} - Resultado de la operación
 */
async function handleContinuar(numero) {
    try {
        // Verificar si hay una conversación inactiva para retomar
        const conversacionInactiva = recuperarConversacionInactiva(numero);
        
        if (!conversacionInactiva) {
            console.log(`❌ Usuario ${numero} no tiene conversación para continuar`);
            await enviarMensaje(numero, "No tienes ninguna conversación reciente para continuar. Por favor escribe 'hola' para comenzar.");
            return { status: "no_hay_conversacion" };
        }

        if (Date.now() > conversacionInactiva.expiracion) {
            // Si expiró, eliminar y pedir comenzar de nuevo
            deleteConversacionInactiva(numero);
            await enviarMensaje(numero, "⏳ Ha pasado demasiado tiempo. Vamos a empezar de nuevo. Por favor escribe 'hola'.");
            return { status: "expirado" };
        }

        // Restaurar estado
        setConversacion(numero, conversacionInactiva.estado);
        deleteConversacionInactiva(numero);
        
        console.log(`🔄 Usuario ${numero} retoma conversación en paso: ${getConversacion(numero).paso}`);
        
        // Informar al usuario dónde estaba
        let mensajeContinuacion = `👌 Continuamos donde quedaste.\n`;
        const estado = getConversacion(numero);
        
        // Agregar mensaje según el paso
        switch(estado.paso) {
            case 2:
                mensajeContinuacion += `Estabas seleccionando la fecha para tu cita.\n¿Para qué fecha quieres la cita?`;
                break;
            case 3:
                mensajeContinuacion += `Habías seleccionado la fecha ${formatearFecha(crearFechaConZonaHoraria(estado.fecha))}.\n¿A qué hora te gustaría la cita?`;
                break;
            case 4:
                mensajeContinuacion += `Habías seleccionado fecha y hora. Ahora necesitamos el motivo de tu cita.`;
                break;
            case "confirmacion":
                mensajeContinuacion = generarResumenCita(estado);
                break;
            // otros casos según necesidad
            default:
                mensajeContinuacion += `Continuamos con tu cita.`;
        }
        
        await enviarMensaje(numero, mensajeContinuacion);
        return { status: "conversacion_retomada" };
    } catch (error) {
        console.error("❌ Error en handleContinuar:", error);
        await enviarMensaje(numero, getMensajeError('general'));
        return { status: "error" };
    }
}

module.exports = {
    handleHola,
    handleContinuar
};