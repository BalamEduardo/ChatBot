/**
 * Punto de entrada para todos los controladores
 * Facilita la importación de controladores en otros módulos
 */
const { handleIncomingMessage } = require('./botController');
const { enviarMensaje } = require('./messageHandler');

module.exports = {
    handleIncomingMessage,
    enviarMensaje
};