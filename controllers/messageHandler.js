/**
 * Manejador de mensajes para WhatsApp
 * Gestiona el envío de mensajes a través de la API de Twilio
 */
const twilio = require('twilio');

// Credenciales de Twilio desde variables de entorno
const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

/**
 * Envía un mensaje a un número de WhatsApp específico
 * @param {string} numero - Número de teléfono del destinatario (sin 'whatsapp:')
 * @param {string} mensaje - Contenido del mensaje a enviar
 * @returns {Promise<Object>} - Resultado de la operación de envío
 */
async function enviarMensaje(numero, mensaje) {
    try {
        // Formatear números
        const numeroFormateado = `whatsapp:${numero}`;
        const numeroTwilio = process.env.TWILIO_PHONE_NUMBER;

        // Troncar el mensaje si es muy largo (límite de Twilio: 1600 caracteres)
        const mensajeTruncado = mensaje.length > 1600 
            ? mensaje.substring(0, 1590) + "... (mensaje truncado)"
            : mensaje;

        // Enviar el mensaje
        const result = await client.messages.create({
            body: mensajeTruncado,
            from: numeroTwilio,
            to: numeroFormateado
        });

        console.log(`✅ Mensaje enviado a ${numero}: ${mensaje.substring(0, 30)}...`);
        return result;
    } catch (error) {
        console.error(`❌ Error enviando mensaje a ${numero}:`, error);
        throw error;
    }
}

module.exports = { enviarMensaje };