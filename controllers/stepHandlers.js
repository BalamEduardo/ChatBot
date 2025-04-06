const { enviarMensaje } = require('./messageHandler');
const { guardarCita } = require('../database/db');
const { HORARIO_DOCTOR, MENSAJES } = require('../config/constants');

// Paso 1: Inicio del flujo
async function manejarPaso1(numero, estado, mensaje) {
    estado.paso = 2; // Avanzar al siguiente paso
    await enviarMensaje(numero, "👋 Hola, ¿cuál es tu nombre?");
}

// Paso 2: Validar nombre y avanzar
async function manejarPaso2(numero, estado, mensaje) {
    estado.nombre = mensaje; // Guardar el nombre
    estado.paso = 3; // Avanzar al siguiente paso
    await enviarMensaje(numero, "¿Qué fecha te gustaría para tu cita?");
}

// Paso 3: Validar fecha y avanzar
async function manejarPaso3(numero, estado, mensaje) {
    // Aquí iría la lógica para validar la fecha
    estado.fecha = mensaje; // Simulación: Guardar la fecha directamente
    estado.paso = 4; // Avanzar al siguiente paso
    await enviarMensaje(numero, "¿A qué hora te gustaría la cita?");
}

// Paso 4: Confirmar cita
async function manejarPaso4(numero, estado, mensaje) {
    estado.hora = mensaje; // Simulación: Guardar la hora directamente
    estado.paso = 'confirmacion'; // Avanzar al paso de confirmación
    await enviarMensaje(numero, `Tu cita está programada para ${estado.fecha} a las ${estado.hora}. ¿Confirmas? (Responde con 4 para confirmar o 5 para cancelar)`);
}

// Confirmar cita
async function manejarConfirmacion(numero, estado, mensaje) {
    if (mensaje === '4') {
        await guardarCita(estado); // Guardar la cita en la base de datos
        await enviarMensaje(numero, MENSAJES.CONFIRMACION);
        return true; // Indica que la conversación terminó
    } else if (mensaje === '5') {
        await enviarMensaje(numero, MENSAJES.CANCELACION);
        return true; // Indica que la conversación terminó
    }
    return false; // La conversación continúa
}

module.exports = {
    manejarPaso1,
    manejarPaso2,
    manejarPaso3,
    manejarPaso4,
    manejarConfirmacion,
};