/**
 * Manejador para interacciones con citas existentes
 */
const { enviarMensaje } = require('../messageHandler');
const { obtenerDiaSemana, formatearFecha, crearFechaConZonaHoraria } = require('../../utils/dateUtils');
const { cancelarCitaPorId } = require('../../database/db');
const { limpiarTimeout } = require('../../utils/timeoutManager');
const { setConversacion, deleteConversacion } = require('../../utils/flowManager');

/**
 * Maneja el menú principal para una cita existente
 * @param {Object} estado - Estado actual de la conversación
 * @param {string} mensaje - Mensaje recibido del usuario
 * @param {string} numero - Número de teléfono del usuario
 * @returns {Promise<Object>} - Resultado del procesamiento
 */
async function handleMenuCitaExistente(estado, mensaje, numero) {
    const opcion = mensaje.trim();

    if (["1", "reagendar", "reagendar cita"].includes(opcion)) {
        // Inicia flujo de reagendación
        console.log(`🔄 Usuario ${numero} inicia reagendación`);
        
        // Precargar datos existentes
        const nuevoEstado = {
            ...estado,
            fecha: estado.citaActiva.fecha,
            hora: estado.citaActiva.hora,
            motivo: estado.citaActiva.motivo,
            nombre: estado.citaActiva.nombre || "Usuario",
            diaSemana: obtenerDiaSemana(estado.citaActiva.fecha),
            paso: "modificando_fecha"
        };

        await enviarMensaje(numero, "📅 ¿Para qué nueva fecha deseas reagendar tu cita?");
        
        return {
            success: true,
            estadoActualizado: nuevoEstado
        };
    }

    if (["2", "nueva", "nueva cita", "agendar", "agendar nueva cita"].includes(opcion)) {
        // Iniciar nuevo flujo de cita
        console.log(`🆕 Usuario ${numero} inicia nueva cita`);
        
        await enviarMensaje(numero, "📋 Vamos a agendar una nueva cita.\n¿Cuál es tu nombre?");
        
        return {
            success: true,
            estadoActualizado: { 
                paso: 1 
            }
        };
    }

    if (["3", "cancelar", "cancelar cita"].includes(opcion)) {
        try {
            console.log(`🚫 Usuario ${numero} cancelando cita ID: ${estado.citaActiva.id}`);
            const citaId = estado.citaActiva.id;
            const cancelada = await cancelarCitaPorId(citaId);

            if (cancelada) {
                await enviarMensaje(numero, "❌ Tu cita ha sido cancelada correctamente. Si deseas agendar otra, escribe *hola*.");
            } else {
                await enviarMensaje(numero, "⚠️ No pude cancelar tu cita. Intenta más tarde o contacta al consultorio.");
            }

            // Limpiar estado
            limpiarTimeout(numero);
            deleteConversacion(numero);
            
            return {
                success: true,
                estadoActualizado: null,
                finalizado: true
            };
        } catch (error) {
            console.error("❌ Error cancelando cita:", error);
            await enviarMensaje(numero, "❌ Hubo un error al cancelar tu cita. Por favor, intenta más tarde.");
            return {
                success: false,
                estadoActualizado: estado
            };
        }
    }

    if (["4", "salir"].includes(opcion)) {
        console.log(`👋 Usuario ${numero} sale del sistema`);
        await enviarMensaje(numero, "👋 ¡Hasta luego! Si necesitas algo más, solo escribe *hola*.");
        
        // Limpiar estado
        limpiarTimeout(numero);
        deleteConversacion(numero);
        
        return {
            success: true,
            estadoActualizado: null,
            finalizado: true
        };
    }

    // Si la opción no es válida
    await enviarMensaje(numero, "❗ Opción no válida. Por favor responde con:\n1️⃣ Reagendar\n2️⃣ Nueva\n3️⃣ Cancelar\n4️⃣ Salir");
    return {
        success: false,
        estadoActualizado: estado
    };
}

module.exports = {
    handleMenuCitaExistente
};