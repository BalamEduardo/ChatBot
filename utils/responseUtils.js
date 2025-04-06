/**
 * Utilidades para generar respuestas y mensajes comunes
 */
const { horarioDoctor } = require('../config/schedule');

/**
 * Genera el mensaje de bienvenida inicial
 * @param {string} nombre - Nombre del usuario (opcional)
 * @returns {string} - Mensaje de bienvenida formateado
 */
function getMensajeBienvenida(nombre = '') {
    const saludo = nombre ? `, ${nombre}` : '';
    return `👋 ¡Hola${saludo}! Soy el asistente virtual para agendar tus citas médicas.

📅 Puedes agendar una cita fácilmente respondiendo algunas preguntas.
⏰ El doctor atiende:
Lunes a Sábado: 9:00 AM - 2:00 PM y 5:00 PM - 8:00 PM
Domingo: 11:00 AM - 1:00 PM

💬 Empecemos... ¿Cuál es tu nombre?`;
}

/**
 * Genera mensaje de error para comando no reconocido
 * @returns {string} - Mensaje de error
 */
function getMensajeNoReconocido() {
    return "❓ No entendí tu mensaje. Si deseas agendar una cita, escribe 'hola' para comenzar de nuevo.";
}

/**
 * Genera mensaje de solicitud de mensaje 'hola'
 * @returns {string} - Mensaje solicitando 'hola'
 */
function getMensajeSolicitarHola() {
    return "👋 Para comenzar a agendar tu cita, por favor escribe 'hola'.";
}

/**
 * Genera mensaje de timeout
 * @returns {string} - Mensaje de timeout
 */
function getMensajeTimeout() {
    return `⏳ Has estado inactivo por un tiempo. Para continuar con tu cita:
1️⃣ Escribe "continuar" - Para seguir desde donde quedaste
2️⃣ Escribe "hola" - Para empezar de nuevo`;
}

/**
 * Genera mensaje de advertencia de inactividad
 * @returns {string} - Mensaje de advertencia
 */
function getMensajeAdvertenciaInactividad() {
    return "⏳ Parece que estás inactivo. Si no respondes en 2 minutos, el chat se cerrará automáticamente. Escribe 'continuar' para seguir donde quedaste o 'hola' para reiniciar.";
}

/**
 * Genera mensaje con el horario del doctor para un día específico
 * @param {string} diaSemana - Día de la semana
 * @returns {string} - Mensaje con el horario formateado
 */
function getMensajeHorarioDelDia(diaSemana) {
    if (!horarioDoctor[diaSemana]) {
        return `❌ El doctor no trabaja el ${diaSemana}.`;
    }
    
    return `Horario para ${diaSemana}:
${horarioDoctor[diaSemana].map(h => `🕒 ${h.inicio} - ${h.fin}`).join('\n')}`;
}

/**
 * Genera mensaje de error para enviar al usuario
 * @param {string} tipo - Tipo de error ('general', 'fecha', 'hora', etc.)
 * @returns {string} - Mensaje de error apropiado
 */
function getMensajeError(tipo = 'general') {
    const mensajes = {
        general: "❌ Hubo un error inesperado. Por favor, escribe 'hola' para reiniciar o contacta al consultorio directamente.",
        fecha: "❌ No pude entender la fecha. Usa un formato como '10 de abril de 2025' o 'el próximo lunes'.",
        hora: "❌ No pude entender la hora. Usa un formato como '10:00 AM' o 'a las 6 de la tarde'.",
        faltaPeriodo: "⏰ Por favor, aclara si deseas la cita por la *mañana* o por la *tarde/noche*. Ejemplo: 'a las 9 de la mañana' o 'a las 9 de la noche'.",
        bd: "❌ Hubo un error al acceder a la base de datos. Por favor, intenta más tarde."
    };
    
    return mensajes[tipo] || mensajes.general;
}

module.exports = {
    getMensajeBienvenida,
    getMensajeNoReconocido,
    getMensajeSolicitarHola,
    getMensajeTimeout,
    getMensajeAdvertenciaInactividad,
    getMensajeHorarioDelDia,
    getMensajeError
};