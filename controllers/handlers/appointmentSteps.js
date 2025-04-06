/**
 * Manejador de pasos para agendar una nueva cita
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
const { getMensajeError, getMensajeHorarioDelDia } = require('../../utils/responseUtils');

/**
 * Maneja el paso 1: obtener el nombre del usuario
 * @param {Object} estado - Estado actual de la conversación
 * @param {string} mensaje - Mensaje recibido del usuario
 * @param {string} numero - Número de teléfono del usuario
 * @returns {Promise<Object>} - Resultado del procesamiento
 */
async function handleNombreStep(estado, mensaje, numero) {
    if (!mensaje.trim()) {
        await enviarMensaje(numero, "❌ Por favor, dime tu nombre para continuar.");
        return { 
            success: false, 
            estadoActualizado: estado 
        };
    }

    // Capitalizar primera letra del nombre
    const nombreCapitalizado = mensaje.charAt(0).toUpperCase() + mensaje.slice(1);
    
    // Actualizar estado
    const nuevoEstado = {
        ...estado,
        nombre: nombreCapitalizado,
        paso: 2
    };
    
    console.log(`✅ Nombre registrado para ${numero}: ${nombreCapitalizado}`);

    // Enviar respuesta
    await enviarMensaje(numero, `Gracias, ${nombreCapitalizado}. ¿Para qué fecha quieres la cita? (Ejemplo: "10 de abril de 2025" o "el próximo lunes")`);
    
    return {
        success: true,
        estadoActualizado: nuevoEstado
    };
}

/**
 * Maneja el paso 2: obtener la fecha de la cita
 * @param {Object} estado - Estado actual de la conversación
 * @param {string} mensaje - Mensaje recibido del usuario
 * @param {string} numero - Número de teléfono del usuario
 * @returns {Promise<Object>} - Resultado del procesamiento
 */
async function handleFechaStep(estado, mensaje, numero) {
    const fechaObjeto = obtenerFechaDesdeTexto(mensaje);

    if (!fechaObjeto) {
        await enviarMensaje(numero, getMensajeError('fecha'));
        return { 
            success: false, 
            estadoActualizado: estado 
        };
    }

    // Validar que la fecha no sea en el pasado
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (fechaObjeto < hoy) {
        await enviarMensaje(numero, "❌ No puedes reservar una cita en una fecha pasada. Por favor, elige otra fecha.");
        return { 
            success: false, 
            estadoActualizado: estado 
        };
    }

    const fechaISO = fechaObjeto.toISOString().split('T')[0]; // Formato YYYY-MM-DD
    const diaSemana = obtenerDiaSemana(fechaISO);
    const fechaFormateada = formatearFecha(fechaObjeto);

    if (!horarioDoctor[diaSemana]) {
        await enviarMensaje(numero, `❌ Lo siento, el doctor no trabaja el ${diaSemana}. Por favor, elige otra fecha.`);
        return { 
            success: false, 
            estadoActualizado: estado 
        };
    }

    // Actualizar estado
    const nuevoEstado = {
        ...estado,
        fecha: fechaISO,
        diaSemana: diaSemana,
        paso: 3
    };
    
    console.log(`✅ Fecha registrada para ${numero}: ${fechaISO} (${diaSemana})`);

    // Enviar respuesta
    await enviarMensaje(numero, `La fecha seleccionada es *${fechaFormateada} (${diaSemana})*.
Recuerda que el horario de atención es:
${horarioDoctor[diaSemana].map(h => `🕒 ${h.inicio} - ${h.fin}`).join('\n')}

¿A qué hora te gustaría la cita?`);

    return {
        success: true,
        estadoActualizado: nuevoEstado
    };
}

/**
 * Maneja el paso 3: obtener la hora de la cita
 * @param {Object} estado - Estado actual de la conversación
 * @param {string} mensaje - Mensaje recibido del usuario
 * @param {string} numero - Número de teléfono del usuario
 * @returns {Promise<Object>} - Resultado del procesamiento
 */
async function handleHoraStep(estado, mensaje, numero) {
    const horaFormateada = obtenerHoraDesdeTexto(mensaje);

    if (!horaFormateada) {
        await enviarMensaje(numero, getMensajeError('hora'));
        return { 
            success: false, 
            estadoActualizado: estado 
        };
    }

    if (horaFormateada === "FALTA_PERIODO") {
        await enviarMensaje(numero, getMensajeError('faltaPeriodo'));
        return { 
            success: false, 
            estadoActualizado: estado 
        };
    }

    // Validar si la hora está dentro del horario del doctor
    const esHoraValida = validarHoraEnHorario(horaFormateada, estado.diaSemana);

    if (!esHoraValida) {
        await enviarMensaje(numero, `❌ La hora seleccionada está fuera del horario de atención. Recuerda que el horario para ${estado.diaSemana} es:
${horarioDoctor[estado.diaSemana].map(h => `🕒 ${h.inicio} - ${h.fin}`).join('\n')}

Por favor, elige otra hora.`);
        return { 
            success: false, 
            estadoActualizado: estado 
        };
    }

    // Actualizar estado
    const nuevoEstado = {
        ...estado,
        hora: horaFormateada,
        paso: 4
    };
    
    console.log(`✅ Hora registrada para ${numero}: ${horaFormateada}`);

    // Enviar respuesta
    await enviarMensaje(numero, "Por último, ¿cuál es el motivo de tu cita?");

    return {
        success: true,
        estadoActualizado: nuevoEstado
    };
}

/**
 * Maneja el paso 4: obtener el motivo de la cita
 * @param {Object} estado - Estado actual de la conversación
 * @param {string} mensaje - Mensaje recibido del usuario
 * @param {string} numero - Número de teléfono del usuario
 * @returns {Promise<Object>} - Resultado del procesamiento
 */
async function handleMotivoStep(estado, mensaje, numero) {
    if (!mensaje.trim()) {
        await enviarMensaje(numero, "❌ Por favor, dime el motivo de la cita para continuar.");
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
    
    console.log(`✅ Motivo registrado para ${numero}: ${mensaje}`);

    // Generar resumen y enviarlo
    const resumen = generarResumenCita(nuevoEstado);
    await enviarMensaje(numero, resumen);

    return {
        success: true,
        estadoActualizado: nuevoEstado
    };
}

module.exports = {
    handleNombreStep,
    handleFechaStep,
    handleHoraStep,
    handleMotivoStep
};