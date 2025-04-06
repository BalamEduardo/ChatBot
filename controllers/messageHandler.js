const twilio = require('twilio');

async function enviarMensaje(numero, mensaje) {
    const twilioClient = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await twilioClient.messages.create({
        from: process.env.TWILIO_PHONE_NUMBER,
        to: `whatsapp:${numero}`,
        body: mensaje
    });
}

module.exports = { enviarMensaje };
