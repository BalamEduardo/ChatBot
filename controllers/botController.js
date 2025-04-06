const { enviarMensaje } = require('./messageHandler');
const { manejarTimeout } = require('../utils/timeoutManager');
const { handleHola, handleContinuar } = require('./handlers/welcomeHandler');
const { 
    handleNombreStep, 
    handleFechaStep, 
    handleHoraStep, 
    handleMotivoStep 
} = require('./handlers/appointmentSteps');
const { handleMenuCitaExistente } = require('./handlers/existingAppointmentHandler');
const { 
    handleModificarFecha, 
    handleModificarHora, 
    handleModificarMotivo, 
    handleConfirmacion 
} = require('./handlers/modificationHandler');
const { 
    getConversacion, 
    setConversacion, 
    deleteConversacion,
    tieneConversacionActiva 
} = require('../utils/flowManager');
const { getMensajeNoReconocido, getMensajeSolicitarHola, getMensajeError } = require('../utils/responseUtils');

/**
 * Maneja un mensaje entrante de WhatsApp
 * @param {Object} req - Objeto de solicitud HTTP
 * @param {Object} res - Objeto de respuesta HTTP
 * @returns {Object} - Respuesta JSON para Twilio
 */
async function handleIncomingMessage(req, res) {
    try {
        const numero = req.body.From.replace('whatsapp:', '');
        const mensaje = req.body.Body.trim().toLowerCase();

        console.log(`📩 Mensaje recibido: "${mensaje}" de ${numero}`);

        // Comandos especiales que funcionan en cualquier contexto
        if (mensaje === "hola") {
            const resultado = await handleHola(numero);
            return res.json({ status: resultado.status });
        }

        if (mensaje === "continuar") {
            const resultado = await handleContinuar(numero);
            return res.json({ status: resultado.status });
        }

        // Si no hay conversación activa y no es un comando especial
        if (!tieneConversacionActiva(numero)) {
            await enviarMensaje(numero, getMensajeSolicitarHola());
            return res.json({ status: "instrucción_enviada" });
        }

        // Reiniciar timeout ya que hubo actividad
        manejarTimeout(numero);

        // Obtener estado actual y procesarlo según el paso
        const estado = getConversacion(numero);
        console.log(`⏱️ Usuario ${numero} en paso: ${estado.paso}`);

        let resultado; // Variable para almacenar el resultado del procesamiento

        // Gestionar el flujo según el paso actual
        switch (estado.paso) {
            // PASOS PARA NUEVA CITA
            case 1:
                resultado = await handleNombreStep(estado, mensaje, numero);
                break;
            case 2:
                resultado = await handleFechaStep(estado, mensaje, numero);
                break;
            case 3:
                resultado = await handleHoraStep(estado, mensaje, numero);
                break;
            case 4:
                resultado = await handleMotivoStep(estado, mensaje, numero);
                break;

            // PASOS PARA CITA EXISTENTE
            case "menu_cita_existente":
                resultado = await handleMenuCitaExistente(estado, mensaje, numero);
                break;

            // PASOS PARA MODIFICACIONES
            case "modificando_fecha":
                resultado = await handleModificarFecha(estado, mensaje, numero);
                break;
            case "modificando_hora":
                resultado = await handleModificarHora(estado, mensaje, numero);
                break;
            case "modificando_motivo":
                resultado = await handleModificarMotivo(estado, mensaje, numero);
                break;
            case "confirmacion":
                resultado = await handleConfirmacion(estado, mensaje, numero);
                break;

            // Paso no reconocido
            default:
                console.error(`❌ Paso no reconocido: ${estado.paso}`);
                await enviarMensaje(numero, "❓ Ocurrió un error. Por favor escribe 'hola' para comenzar de nuevo.");
                deleteConversacion(numero);
                return res.json({ status: "error_paso_desconocido" });
        }

        // Procesar el resultado
        if (resultado) {
            // Si el procesamiento fue exitoso
            if (resultado.success) {
                // Si la conversación ha finalizado (confirmación o cancelación)
                if (resultado.finalizado) {
                    return res.json({ status: "conversación_finalizada" });
                }
                
                // Actualizar el estado si hay uno nuevo
                if (resultado.estadoActualizado) {
                    setConversacion(numero, resultado.estadoActualizado);
                }
                
                return res.json({ status: "mensaje_procesado" });
            }
            // Si hubo un error en el procesamiento, ya se envió un mensaje al usuario
            return res.json({ status: "error_procesamiento" });
        }

        // Si llegamos aquí, es un mensaje que no encaja en ningún flujo
        console.log(`❓ Mensaje no reconocido de ${numero}: "${mensaje}"`);
        await enviarMensaje(numero, getMensajeNoReconocido());
        return res.json({ status: "mensaje_no_reconocido" });
    } catch (error) {
        console.error("❌ Error no manejado en handleIncomingMessage:", error);
        try {
            await enviarMensaje(req.body.From.replace('whatsapp:', ''), getMensajeError('general'));
        } catch (msgError) {
            console.error("❌ Error adicional enviando mensaje de error:", msgError);
        }
        return res.json({ status: "error_general" });
    }
}

module.exports = { handleIncomingMessage };