/**
 * Gestor del flujo de conversación
 * Centraliza el manejo de los estados de conversación activas e inactivas
 */

// Objeto para mantener el estado de las conversaciones activas
const conversaciones = {};
// Objeto para guardar temporalmente conversaciones pausadas por inactividad
const conversacionesInactivas = {};

/**
 * Obtiene el estado de conversación actual de un usuario
 * @param {string} numero - Número de teléfono del usuario
 * @returns {Object|null} - Estado de la conversación o null si no existe
 */
function getConversacion(numero) {
    return conversaciones[numero];
}

/**
 * Guarda o actualiza el estado de conversación de un usuario
 * @param {string} numero - Número de teléfono del usuario
 * @param {Object} estado - Estado de la conversación
 */
function setConversacion(numero, estado) {
    conversaciones[numero] = estado;
}

/**
 * Elimina la conversación activa de un usuario
 * @param {string} numero - Número de teléfono del usuario
 */
function deleteConversacion(numero) {
    delete conversaciones[numero];
}

/**
 * Guarda una conversación como inactiva (para recuperación posterior)
 * @param {string} numero - Número de teléfono del usuario
 * @param {Object} estado - Estado de la conversación
 * @param {number} tiempoExpiracion - Tiempo en ms hasta que expire (default: 30min)
 */
function guardarConversacionInactiva(numero, estado, tiempoExpiracion = 30 * 60 * 1000) {
    conversacionesInactivas[numero] = {
        estado,
        timestamp: Date.now(),
        expiracion: Date.now() + tiempoExpiracion
    };
}

/**
 * Recupera una conversación inactiva si existe y no ha expirado
 * @param {string} numero - Número de teléfono del usuario
 * @returns {Object|null} - Estado de conversación inactiva o null si no existe o expiró
 */
function recuperarConversacionInactiva(numero) {
    const conversacionInactiva = conversacionesInactivas[numero];
    
    if (!conversacionInactiva) {
        return null;
    }
    
    if (Date.now() > conversacionInactiva.expiracion) {
        delete conversacionesInactivas[numero];
        return null;
    }
    
    return conversacionInactiva;
}

/**
 * Elimina una conversación inactiva
 * @param {string} numero - Número de teléfono del usuario
 */
function deleteConversacionInactiva(numero) {
    delete conversacionesInactivas[numero];
}

/**
 * Verifica si un usuario tiene una conversación activa
 * @param {string} numero - Número de teléfono del usuario
 * @returns {boolean} - true si tiene conversación, false si no
 */
function tieneConversacionActiva(numero) {
    return !!conversaciones[numero];
}

module.exports = {
    getConversacion,
    setConversacion,
    deleteConversacion,
    guardarConversacionInactiva,
    recuperarConversacionInactiva,
    deleteConversacionInactiva,
    tieneConversacionActiva,
    // Exportar las referencias directas para uso específico si es necesario
    conversaciones,
    conversacionesInactivas
};