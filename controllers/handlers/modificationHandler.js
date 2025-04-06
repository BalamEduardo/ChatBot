/**
 * Manejador para modificaciones a citas (fecha, hora, motivo)
 */
const { 
    obtenerFechaDesdeTexto, 
    obtenerHoraDesdeTexto, 
    formatearFecha, 
    crearFechaConZonaHoraria,
    obtenerDiaSemana 
} = require('../../utils/dateUtils');
const { validarHoraEnHorario } = require('../../utils/validation');
const { enviarMensaje } = require('../messageHandler');
const { horarioDoctor } = require('../../config/schedule');
const { generarResumenCita } = require('../../utils/resumenUtils');
const { getMensajeError } = require('../../utils/responseUtils');
const { reagendarCita, guardarCita } = require('../../database/db');
const { limpiarTimeout } = require('../../utils/timeoutManager');
const { deleteConversacion } = require('../../utils/flowManager');

/**
 * Maneja la modificación de la fecha de una cita
 * @param {Object} estado - Estado actual de la conversación
 * @param {string} mensaje - Mensaje recibido del usuario
 * @param {string} numero - Número de teléfono del usuario
 * @returns {Promise<Object>} - Resultado del procesamiento
 */
async function handleModificarFecha(estado, mensaje, numero) {
    const nuevaFecha = obtenerFechaDesdeTexto(mensaje);

    if (!nuevaFecha) {
        await enviarMensaje(numero, getMensajeError('fecha'));
        return { 
            success: false, 
            estadoActualizado: estado 
        };
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (nuevaFecha < hoy) {
        await enviarMensaje(numero, "❌ No puedes reservar una cita en el pasado. Elige otra fecha.");
        return { 
            success: false, 
            estadoActualizado: estado 
        };
    }

    const fechaISO = nuevaFecha.toISOString().split('T')[0];
    const diaSemana = obtenerDiaSemana(fechaISO);

    if (!horarioDoctor[diaSemana]) {
        await enviarMensaje(numero, `❌ El doctor no trabaja el ${diaSemana}. Por favor elige otro día.`);
        return { 
            success: false, 
            estadoActualizado: estado 
        };
    }

    // Actualizar estado con la nueva fecha
    const nuevoEstado = {
        ...estado,
        fecha: fechaISO,
        diaSemana: diaSemana
    };
    
    console.log(`✅ Nueva fecha para ${numero}: ${fechaISO} (${diaSemana})`);

    // Verificar si la hora existente sigue siendo válida con la nueva fecha
    if (estado.hora) {
        const horaValida = validarHoraEnHorario(estado.hora, diaSemana);
        if (!horaValida) {
            // La hora ya no es válida para esta fecha, pasar a modificar hora
            nuevoEstado.paso = "modificando_hora";
            await enviarMensaje(numero, `⚠️ La hora actual (${estado.hora}) no está disponible para el ${diaSemana}.

🕒 Horarios disponibles:
${horarioDoctor[diaSemana].map(h => `• ${h.inicio} - ${h.fin}`).join('\n')}

¿A qué hora te gustaría tu cita?`);
            return { 
                success: true, 
                estadoActualizado: nuevoEstado 
            };
        }
    }

    // Si no hay problema con la hora, ir a confirmación
    nuevoEstado.paso = "confirmacion";
    const resumen = generarResumenCita(nuevoEstado);
    await enviarMensaje(numero, resumen);
    
    return {
        success: true,
        estadoActualizado: nuevoEstado
    };
}

/**
 * Maneja la modificación de la hora de una cita
 * @param {Object} estado - Estado actual de la conversación
 * @param {string} mensaje - Mensaje recibido del usuario
 * @param {string} numero - Número de teléfono del usuario
 * @returns {Promise<Object>} - Resultado del procesamiento
 */
async function handleModificarHora(estado, mensaje, numero) {
    const nuevaHora = obtenerHoraDesdeTexto(mensaje);

    if (!nuevaHora) {
        await enviarMensaje(numero, getMensajeError('hora'));
        return { 
            success: false, 
            estadoActualizado: estado 
        };
    }

    if (nuevaHora === "FALTA_PERIODO") {
        await enviarMensaje(numero, getMensajeError('faltaPeriodo'));
        return { 
            success: false, 
            estadoActualizado: estado 
        };
    }

    // Usar el día de la semana actualizado o calcularlo
    const diaSemana = estado.diaSemana || obtenerDiaSemana(estado.fecha || estado.citaActiva?.fecha);

    const esHoraValida = validarHoraEnHorario(nuevaHora, diaSemana);
    if (!esHoraValida) {
        await enviarMensaje(numero, `❌ La hora está fuera del horario de atención del ${diaSemana}.
🕒 Horarios válidos:
${horarioDoctor[diaSemana].map(h => `• ${h.inicio} - ${h.fin}`).join('\n')}`);
        return { 
            success: false, 
            estadoActualizado: estado 
        };
    }

    // Actualizar estado
    const nuevoEstado = {
        ...estado,
        hora: nuevaHora,
        paso: "confirmacion"
    };
    
    console.log(`✅ Nueva hora para ${numero}: ${nuevaHora}`);

    // Generar resumen
    const resumen = generarResumenCita(nuevoEstado);
    await enviarMensaje(numero, resumen);
    
    return {
        success: true,
        estadoActualizado: nuevoEstado
    };
}

/**
 * Maneja la modificación del motivo de una cita
 * @param {Object} estado - Estado actual de la conversación
 * @param {string} mensaje - Mensaje recibido del usuario
 * @param {string} numero - Número de teléfono del usuario
 * @returns {Promise<Object>} - Resultado del procesamiento
 */
async function handleModificarMotivo(estado, mensaje, numero) {
    if (!mensaje.trim()) {
        await enviarMensaje(numero, "❌ Por favor, dime el motivo de tu cita.");
        return { 
            success: false, 
            estadoActualizado: estado 
        };
    }

    // Actualizar estado
    const nuevoEstado = {
        ...estado,
        motivo: mensaje,
        paso: "confirmacion"
    };
    
    console.log(`✅ Nuevo motivo para ${numero}: ${mensaje}`);

    // Generar resumen
    const resumen = generarResumenCita(nuevoEstado);
    await enviarMensaje(numero, resumen);
    
    return {
        success: true,
        estadoActualizado: nuevoEstado
    };
}

/**
 * Maneja la confirmación final de una cita (nueva o reagendada)
 * @param {Object} estado - Estado actual de la conversación
 * @param {string} mensaje - Mensaje recibido del usuario
 * @param {string} numero - Número de teléfono del usuario
 * @returns {Promise<Object>} - Resultado del procesamiento
 */
async function handleConfirmacion(estado, mensaje, numero) {
    const opcion = mensaje.trim();

    // Sinónimos de cada opción
    const opciones = {
        fecha: ["1", "fecha", "cambiar fecha"],
        hora: ["2", "hora", "cambiar hora"],
        motivo: ["3", "motivo", "cambiar motivo"],
        confirmar: ["4", "confirmar", "confirmar cita", "sí", "si"],
        cancelar: ["5", "cancelar", "cancelar cita", "anular"]
    };

    // Opción 1: Modificar fecha
    if (opciones.fecha.includes(opcion)) {
        const nuevoEstado = {
            ...estado,
            paso: "modificando_fecha"
        };
        
        console.log(`🔄 Usuario ${numero} modificando fecha`);
        await enviarMensaje(numero, "📅 ¿Para qué fecha quieres la cita?");
        
        return {
            success: true,
            estadoActualizado: nuevoEstado
        };
    }

    // Opción 2: Modificar hora
    if (opciones.hora.includes(opcion)) {
        const nuevoEstado = {
            ...estado,
            paso: "modificando_hora"
        };
        
        console.log(`🔄 Usuario ${numero} modificando hora`);
        await enviarMensaje(numero, "🕒 ¿A qué hora te gustaría la cita?");
        
        return {
            success: true,
            estadoActualizado: nuevoEstado
        };
    }

    // Opción 3: Modificar motivo
    if (opciones.motivo.includes(opcion)) {
        const nuevoEstado = {
            ...estado,
            paso: "modificando_motivo"
        };
        
        console.log(`🔄 Usuario ${numero} modificando motivo`);
        await enviarMensaje(numero, "📝 ¿Cuál es el motivo de tu cita?");
        
        return {
            success: true,
            estadoActualizado: nuevoEstado
        };
    }

    // Opción 4: Confirmar
    if (opciones.confirmar.includes(opcion)) {
        try {
            // Si es una reagendación de cita existente
            if (estado.citaActiva && estado.citaActiva.id) {
                console.log(`🔄 Usuario ${numero} reagendando cita ID: ${estado.citaActiva.id}`);
                // Usar los valores actualizados o mantener los originales
                const nuevaFecha = estado.fecha || estado.citaActiva.fecha;
                const nuevaHora = estado.hora || estado.citaActiva.hora;
                const nuevoMotivo = estado.motivo || estado.citaActiva.motivo;

                // Reagendar la cita existente
                const exito = await reagendarCita(estado.citaActiva.id, nuevaFecha, nuevaHora, nuevoMotivo);

                if (exito) {
                    // Usar la función centralizada de resumen
                    await enviarMensaje(numero, generarResumenCita({
                        fecha: nuevaFecha,
                        hora: nuevaHora,
                        motivo: nuevoMotivo,
                        diaSemana: obtenerDiaSemana(nuevaFecha),
                        citaActiva: estado.citaActiva
                    }, true));
                } else {
                    await enviarMensaje(numero, "❌ Hubo un error reagendando tu cita. Por favor, inténtalo más tarde o comunícate directamente con el consultorio.");
                }
            } else {
                // Es una cita nueva, guardar
                console.log(`✅ Usuario ${numero} confirmando cita nueva`);
                const datosCompletos = {
                    ...estado,
                    telefono: numero
                };
                
                await guardarCita(datosCompletos);
                await enviarMensaje(numero, generarResumenCita(datosCompletos, true));
            }

            // Limpiar la conversación
            limpiarTimeout(numero);
            deleteConversacion(numero);
            
            console.log(`🏁 Conversación finalizada con ${numero}: Cita ${estado.citaActiva ? 'reagendada' : 'registrada'}`);
            
            return {
                success: true,
                estadoActualizado: null,
                finalizado: true
            };
        } catch (error) {
            console.error("❌ Error guardando/reagendando la cita:", error);
            await enviarMensaje(numero, "❌ Hubo un error procesando tu cita. Inténtalo más tarde o comunícate directamente con el consultorio.");
            return {
                success: false,
                estadoActualizado: estado
            };
        }
    }

    // Opción 5: Cancelar
    if (opciones.cancelar.includes(opcion)) {
        console.log(`🚫 Usuario ${numero} cancelando proceso`);
        limpiarTimeout(numero);
        deleteConversacion(numero);
        
        await enviarMensaje(numero, "❌ El proceso ha sido cancelado. Si deseas agendar una cita, escribe 'hola'.");
        
        return {
            success: true,
            estadoActualizado: null,
            finalizado: true
        };
    }

    // Si el mensaje no coincide con ninguna opción
    await enviarMensaje(numero, "❗ Por favor, responde con una de las opciones del menú:\n1️⃣ Fecha\n2️⃣ Hora\n3️⃣ Motivo\n4️⃣ Confirmar\n5️⃣ Cancelar");
    return {
        success: false,
        estadoActualizado: estado
    };
}

module.exports = {
    handleModificarFecha,
    handleModificarHora,
    handleModificarMotivo,
    handleConfirmacion
};