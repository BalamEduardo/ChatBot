const { obtenerFechaDesdeTexto, obtenerHoraDesdeTexto, formatearFecha } = require('../utils/dateUtils');
const { validarHoraEnHorario } = require('../utils/validation');
const { guardarCita, obtenerCitaActivaPorTelefono, cancelarCitaPorId, reagendarCita } = require('../database/db');
const { enviarMensaje } = require('./messageHandler');
const { horarioDoctor } = require('../config/schedule');
const { generarResumenCita } = require('../utils/resumenUtils');
const { configurarTimeout, limpiarTimeout } = require('../utils/timeoutManager');

const TIEMPO_ADVERTENCIA = 3 * 60 * 1000; // 3 minutos
const TIEMPO_FINALIZACION = 5 * 60 * 1000; // 5 minutos

// Objeto para mantener el estado de las conversaciones activas
const conversaciones = {};

async function handleIncomingMessage(req, res) {
    const numero = req.body.From.replace('whatsapp:', '');
    const mensaje = req.body.Body.trim().toLowerCase();

    console.log(`📩 Mensaje recibido: "${mensaje}" de ${numero}`);

    // Configurar o reiniciar los timeouts de advertencia y finalización
    configurarTimeout(
        numero,
        TIEMPO_ADVERTENCIA,
        TIEMPO_FINALIZACION,
        async () => {
            // Advertencia de inactividad
            await enviarMensaje(numero, "⏳ Parece que estás inactivo. Si no respondes en 2 minutos, el chat se cerrará automáticamente.");
            console.log(`⚠️ Advertencia enviada a ${numero}`);
        },
        async () => {
            // Finalización por inactividad
            delete conversaciones[numero];
            await enviarMensaje(numero, "⏳ Has estado inactivo por mucho tiempo. Si necesitas algo, escribe 'hola' para comenzar de nuevo.");
            console.log(`⏳ Conversación con ${numero} finalizada por inactividad.`);
        }
    );

    // Si es un usuario nuevo o conversación nueva
    if (!conversaciones[numero]) {
        limpiarTimeout(numero); // Limpiar cualquier timeout previo
        const citaActiva = await obtenerCitaActivaPorTelefono(numero);

        if (citaActiva) {
            // Mostrar bienvenida personalizada con la cita existente
            const fechaObj = new Date(citaActiva.fecha);
            const fecha = fechaObj.toLocaleDateString('es-MX');
            const diaTexto = fechaObj.toLocaleDateString('es-MX', { weekday: 'long' });

            const resumen = `👋 ¡Hola! Soy tu asistente virtual para citas médicas.\n\n🧾 Tienes la siguiente cita registrada:\n📅 ${diaTexto} ${fecha}\n🕒 ${citaActiva.hora}\n📌 Motivo: ${citaActiva.motivo}\n\n¿Qué te gustaría hacer?\n1️⃣ Reagendar esta cita\n2️⃣ Agendar una nueva\n3️⃣ Cancelar la cita\n4️⃣ Salir`;

            conversaciones[numero] = {
                paso: 'menu_cita_existente',
                citaActiva
            };

            await enviarMensaje(numero, resumen);
            return res.json({ status: "mensaje enviado" });
        }

        // Si NO hay cita previa, inicio de flujo normal
        conversaciones[numero] = { paso: 1 };

        await enviarMensaje(numero, `👋 ¡Hola! Soy el asistente virtual para agendar tus citas médicas.\n\n📅 Puedes agendar una cita fácilmente respondiendo algunas preguntas.\n⏰ El doctor atiende:\nLunes a Sábado: 9:00 AM - 2:00 PM y 5:00 PM - 8:00 PM\nDomingo: 11:00 AM - 1:00 PM\n\n💬 Empecemos... ¿Cuál es tu nombre?`);
        return res.json({ status: "mensaje enviado" });
    }

    const estado = conversaciones[numero];

    // Ejemplo: Confirmar la cita
    if (estado.paso === 'confirmacion' && mensaje === '4') {
        await guardarCita(estado);
        limpiarTimeout(numero); // Limpiar el timeout porque la conversación terminó
        delete conversaciones[numero]; // Eliminar el estado de la conversación
        await enviarMensaje(numero, "✅ Tu cita ha sido confirmada. ¡Gracias!");
        return res.json({ status: "cita confirmada" });
    }

    // Ejemplo: Cancelar la cita
    if (estado.paso === 'confirmacion' && mensaje === '5') {
        limpiarTimeout(numero); // Limpiar el timeout porque la conversación terminó
        delete conversaciones[numero]; // Eliminar el estado de la conversación
        await enviarMensaje(numero, "❌ Tu cita ha sido cancelada. Si necesitas algo más, no dudes en escribirme.");
        return res.json({ status: "cita cancelada" });
    }

    // Ejemplo: Reiniciar el flujo si el usuario escribe "hola"
    if (mensaje === 'hola') {
        limpiarTimeout(numero); // Limpiar el timeout anterior
        conversaciones[numero] = { paso: 1 }; // Reiniciar el estado de la conversación
        await enviarMensaje(numero, "👋 ¡Hola de nuevo! Vamos a comenzar desde el principio. ¿Cuál es tu nombre?");
        return res.json({ status: "nuevo flujo iniciado" });
    }

    // MANEJO DE FLUJOS DE CONVERSACIÓN

    // Paso 1: Obtener el nombre del usuario
    if (estado.paso === 1) {
        if (!mensaje.trim()) {
            await enviarMensaje(numero, "❌ Por favor, dime tu nombre para continuar.");
            return res.json({ status: "mensaje enviado" });
        }

        estado.nombre = mensaje.charAt(0).toUpperCase() + mensaje.slice(1);
        estado.paso = 2;
        await enviarMensaje(numero, `Gracias, ${estado.nombre}. ¿Para qué fecha quieres la cita? (Ejemplo: "10 de abril de 2025" o "el próximo lunes")`);
        return res.json({ status: "mensaje enviado" });
    }

    // Paso 2: Obtener la fecha y validar si es un día válido
    if (estado.paso === 2) {
        const fechaObjeto = obtenerFechaDesdeTexto(mensaje);

        if (!fechaObjeto) {
            await enviarMensaje(numero, "❌ No pude entender la fecha. Usa un formato como '10 de abril de 2025' o 'el próximo lunes'.");
            return res.json({ status: "mensaje enviado" });
        }

        // Validar que la fecha no sea en el pasado
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0); // Eliminar la hora para comparar solo la fecha

        if (fechaObjeto < hoy) {
            await enviarMensaje(numero, "❌ No puedes reservar una cita en una fecha pasada. Por favor, elige otra fecha.");
            return res.json({ status: "mensaje enviado" });
        }

        const fechaFormateada = formatearFecha(fechaObjeto);
        const fechaISO = fechaObjeto.toISOString().split('T')[0]; // Formato YYYY-MM-DD

        const diasSemana = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
        const diaSemana = diasSemana[fechaObjeto.getDay()];

        if (!horarioDoctor[diaSemana]) {
            await enviarMensaje(numero, `❌ Lo siento, el doctor no trabaja el ${diaSemana}. Por favor, elige otra fecha.`);
            return res.json({ status: "mensaje enviado" });
        }

        estado.fecha = fechaISO; // Guardar fecha en formato YYYY-MM-DD
        estado.diaSemana = diaSemana;
        estado.paso = 3;
        await enviarMensaje(numero, `La fecha seleccionada es *${fechaFormateada} (${estado.diaSemana})*.\nRecuerda que el horario de atención es:\n${horarioDoctor[diaSemana].map(h => `🕒 ${h.inicio} - ${h.fin}`).join('\n')}\n\n¿A qué hora te gustaría la cita?`);
        return res.json({ status: "mensaje enviado" });
    }

    // Paso 3: Obtener la hora y validar si está dentro del horario
    if (estado.paso === 3) {
        const horaFormateada = obtenerHoraDesdeTexto(mensaje);

        if (!horaFormateada) {
            await enviarMensaje(numero, "❌ No pude entender la hora. Usa un formato como '10:00 AM' o 'a las 6 de la tarde'.");
            return res.json({ status: "mensaje enviado" });
        }

        if (horaFormateada === "FALTA_PERIODO") {
            await enviarMensaje(numero, "⏰ Por favor, aclara si deseas la cita por la *mañana* o por la *tarde/noche*. Ejemplo: 'a las 9 de la mañana' o 'a las 9 de la noche'.");
            return res.json({ status: "mensaje enviado" });
        }

        // Validar si la hora está dentro del horario del doctor
        const esHoraValida = validarHoraEnHorario(horaFormateada, estado.diaSemana);

        if (!esHoraValida) {
            await enviarMensaje(numero, `❌ La hora seleccionada está fuera del horario de atención. Recuerda que el horario para ${estado.diaSemana} es:\n${horarioDoctor[estado.diaSemana].map(h => `🕒 ${h.inicio} - ${h.fin}`).join('\n')}\n\nPor favor, elige otra hora.`);
            return res.json({ status: "mensaje enviado" });
        }

        estado.hora = horaFormateada;
        estado.paso = 4;
        await enviarMensaje(numero, "Por último, ¿cuál es el motivo de tu cita?");
        return res.json({ status: "mensaje enviado" });
    }

    // Paso 4: Guardar el motivo y mostrar resumen
    if (estado.paso === 4) {
        if (!mensaje.trim()) {
            await enviarMensaje(numero, "❌ Por favor, dime el motivo de la cita para continuar.");
            return res.json({ status: "mensaje enviado" });
        }

        estado.motivo = mensaje;
        estado.paso = "confirmacion";

        // Preparar formato de fecha para mostrar
        const fechaObj = new Date(`${estado.fecha}T00:00:00`); // Forzar interpretación en hora local
        const fechaFormateada = formatearFecha(fechaObj);

        const resumen = `📋 Tu cita:\n📅 ${estado.diaSemana} ${fechaFormateada}\n🕒 ${estado.hora}\n📌 ${estado.motivo}\n\n¿Deseas hacer un cambio?\n1️⃣ Fecha\n2️⃣ Hora\n3️⃣ Motivo\n4️⃣ Confirmar \n5️⃣ Cancelar`;

        await enviarMensaje(numero, resumen);
        return res.json({ status: "mensaje enviado" });
    }

    // Paso "confirmacion": el usuario elige confirmar, modificar o cancelar
    if (estado.paso === "confirmacion") {
        const opcion = mensaje.trim();

        // Sinónimos de cada opción
        const opciones = {
            fecha: ["1", "fecha", "cambiar fecha"],
            hora: ["2", "hora", "cambiar hora"],
            motivo: ["3", "motivo", "cambiar motivo"],
            confirmar: ["4", "confirmar", "confirmar cita", "sí", "si"],
            cancelar: ["5", "cancelar", "cancelar cita", "anular"]
        };

        if (opciones.fecha.includes(opcion)) {
            estado.paso = "modificando_fecha";
            await enviarMensaje(numero, "📅 ¿Para qué fecha quieres la cita?");
            return res.json({ status: "mensaje enviado" });
        }

        if (opciones.hora.includes(opcion)) {
            estado.paso = "modificando_hora";
            await enviarMensaje(numero, "🕒 ¿A qué hora te gustaría la cita?");
            return res.json({ status: "mensaje enviado" });
        }

        if (opciones.motivo.includes(opcion)) {
            estado.paso = "modificando_motivo";
            await enviarMensaje(numero, "📝 ¿Cuál es el motivo de tu cita?");
            return res.json({ status: "mensaje enviado" });
        }

        if (opciones.confirmar.includes(opcion)) {
            try {
                // Si es una reagendación de cita existente
                if (estado.citaActiva && estado.citaActiva.id) {
                    // Usar los valores actualizados o mantener los originales
                    const nuevaFecha = estado.fecha || estado.citaActiva.fecha;
                    const nuevaHora = estado.hora || estado.citaActiva.hora;
                    const nuevoMotivo = estado.motivo || estado.citaActiva.motivo;

                    // Reagendar la cita existente
                    const exito = await reagendarCita(estado.citaActiva.id, nuevaFecha, nuevaHora, nuevoMotivo);

                    if (exito) {
                        const fechaObj = new Date(nuevaFecha);
                        const fechaFormateada = formatearFecha(fechaObj);
                        await enviarMensaje(numero, `✅ ¡Tu cita ha sido reagendada con éxito!\n📅 Fecha: ${fechaFormateada}\n🕒 Hora: ${nuevaHora}\n📌 Motivo: ${nuevoMotivo}\n\nGracias por utilizar nuestro servicio. 😊`);
                    } else {
                        await enviarMensaje(numero, "❌ Hubo un error reagendando tu cita. Por favor, inténtalo más tarde o comunícate directamente con el consultorio.");
                    }
                } else {
                    // Es una cita nueva, guardar
                    estado.telefono = numero;
                    await guardarCita(estado);
                    await enviarMensaje(numero, `✅ ¡Tu cita ha sido registrada!\n📅 Fecha: ${formatearFecha(new Date(estado.fecha))}\n🕒 Hora: ${estado.hora}\n📌 Motivo: ${estado.motivo}\n\nGracias por reservar con nosotros. 😊`);
                }
                // Limpiar la conversación
                limpiarTimeout(numero); // Limpiar el timeout porque la conversación terminó
                delete conversaciones[numero]; // Eliminar el estado de la conversación
            } catch (error) {
                console.error("❌ Error guardando/reagendando la cita:", error);
                await enviarMensaje(numero, "❌ Hubo un error procesando tu cita. Inténtalo más tarde o comunícate directamente con el consultorio.");
            }
            return res.json({ status: "mensaje enviado" });
        }

        if (opciones.cancelar.includes(opcion)) {
            limpiarTimeout(numero); // Limpiar el timeout porque la conversación terminó
            delete conversaciones[numero]; // Eliminar el estado de la conversación
            await enviarMensaje(numero, "❌ La cita ha sido cancelada. Si deseas agendar otra, escribe 'hola'.");
            return res.json({ status: "mensaje enviado" });
        }

        // Si el mensaje no coincide con ninguna opción
        await enviarMensaje(numero, "❗ Por favor, responde con una de las opciones del menú:\n1️⃣ Fecha\n2️⃣ Hora\n3️⃣ Motivo\n4️⃣ Confirmar\n5️⃣ Cancelar");
        return res.json({ status: "mensaje enviado" });
    }

    // Paso "menu_cita_existente": el usuario tiene una cita activa y puede reagendar, cancelar, etc.
    if (estado.paso === "menu_cita_existente") {
        const opcion = mensaje.trim();

        if (["1", "reagendar", "reagendar cita"].includes(opcion)) {
            // Inicia flujo de modificación desde la fecha
            // Precargar los datos existentes
            estado.fecha = estado.citaActiva.fecha;
            estado.hora = estado.citaActiva.hora;
            estado.motivo = estado.citaActiva.motivo;
            estado.nombre = estado.citaActiva.nombre || "Usuario";

            // Determinar el día de la semana
            const fechaObj = new Date(estado.fecha);
            const diasSemana = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
            estado.diaSemana = diasSemana[fechaObj.getDay()];

            estado.paso = "modificando_fecha";
            await enviarMensaje(numero, "📅 ¿Para qué nueva fecha deseas reagendar tu cita?");
            return res.json({ status: "mensaje enviado" });
        }

        if (["2", "nueva", "nueva cita", "agendar", "agendar nueva cita"].includes(opcion)) {
            // Inicia nuevo flujo de cita desde cero
            conversaciones[numero] = { paso: 1 };
            await enviarMensaje(numero, "📋 Vamos a agendar una nueva cita.\n¿Cuál es tu nombre?");
            return res.json({ status: "mensaje enviado" });
        }

        if (["3", "cancelar", "cancelar cita"].includes(opcion)) {
            const citaId = estado.citaActiva.id;
            const cancelada = await cancelarCitaPorId(citaId);

            if (cancelada) {
                await enviarMensaje(numero, "❌ Tu cita ha sido cancelada correctamente. Si deseas agendar otra, escribe *hola*.");
            } else {
                await enviarMensaje(numero, "⚠️ No pude cancelar tu cita. Intenta más tarde o contacta al consultorio.");
            }

            limpiarTimeout(numero); // Limpiar el timeout porque la conversación terminó
            delete conversaciones[numero]; // Eliminar el estado de la conversación
            return res.json({ status: "mensaje enviado" });
        }

        if (["4", "salir"].includes(opcion)) {
            await enviarMensaje(numero, "👋 ¡Hasta luego! Si necesitas algo más, solo escribe *hola*.");
            limpiarTimeout(numero); // Limpiar el timeout porque la conversación terminó
            delete conversaciones[numero]; // Eliminar el estado de la conversación
            return res.json({ status: "mensaje enviado" });
        }

        // Si la opción no es válida
        await enviarMensaje(numero, "❗ Opción no válida. Por favor responde con:\n1️⃣ Reagendar\n2️⃣ Nueva\n3️⃣ Cancelar\n4️⃣ Salir");
        return res.json({ status: "mensaje enviado" });
    }

    // Paso "modificando_fecha": el usuario está modificando la fecha
    if (estado.paso === "modificando_fecha") {
        const nuevaFecha = obtenerFechaDesdeTexto(mensaje);

        if (!nuevaFecha) {
            await enviarMensaje(numero, "❌ No pude entender la fecha. Usa un formato como '10 de abril de 2025'.");
            return res.json({ status: "mensaje enviado" });
        }

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        if (nuevaFecha < hoy) {
            await enviarMensaje(numero, "❌ No puedes reservar una cita en el pasado. Elige otra fecha.");
            return res.json({ status: "mensaje enviado" });
        }

        const fechaISO = nuevaFecha.toISOString().split('T')[0];

        const diasSemana = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
        const diaSemana = diasSemana[nuevaFecha.getDay()];

        if (!horarioDoctor[diaSemana]) {
            await enviarMensaje(numero, `❌ El doctor no trabaja el ${diaSemana}. Por favor elige otro día.`);
            return res.json({ status: "mensaje enviado" });
        }

        estado.fecha = fechaISO;
        estado.diaSemana = diaSemana;

        // Después de cambiar la fecha, debemos verificar si la hora existente sigue siendo válida
        if (estado.hora) {
            const horaValida = validarHoraEnHorario(estado.hora, diaSemana);
            if (!horaValida) {
                estado.paso = "modificando_hora";
                await enviarMensaje(numero, `⚠️ La hora actual (${estado.hora}) no está disponible para el ${diaSemana}.\n\n🕒 Horarios disponibles:\n${horarioDoctor[diaSemana].map(h => `• ${h.inicio} - ${h.fin}`).join('\n')}\n\n¿A qué hora te gustaría tu cita?`);
                return res.json({ status: "mensaje enviado" });
            }
        }

        // Si no tenemos hora o la hora es válida, vamos a confirmación
        estado.paso = "confirmacion";

        // Generar resumen de la cita
        const fechaFormateada = formatearFecha(nuevaFecha);

        // Usar los valores actuales o los de la cita activa si existen
        const hora = estado.hora || (estado.citaActiva ? estado.citaActiva.hora : "no definida");
        const motivo = estado.motivo || (estado.citaActiva ? estado.citaActiva.motivo : "no definido");

        const resumen = `📋 Cita actualizada:\n📅 ${diaSemana} ${fechaFormateada}\n🕒 ${hora}\n📌 ${motivo}\n\n¿Deseas hacer otro cambio?\n1️⃣ Fecha\n2️⃣ Hora\n3️⃣ Motivo\n4️⃣ Confirmar\n5️⃣ Cancelar`;

        await enviarMensaje(numero, resumen);
        return res.json({ status: "mensaje enviado" });
    }

    // Paso "modificando_hora": el usuario está modificando la hora
    if (estado.paso === "modificando_hora") {
        const nuevaHora = obtenerHoraDesdeTexto(mensaje);

        if (!nuevaHora) {
            await enviarMensaje(numero, "❌ No entendí la hora. Usa un formato como '10:00 AM' o '6 de la tarde'.");
            return res.json({ status: "mensaje enviado" });
        }

        if (nuevaHora === "FALTA_PERIODO") {
            await enviarMensaje(numero, "⏰ Por favor, aclara si deseas la cita por la *mañana* o por la *tarde/noche*. Ejemplo: 'a las 9 de la mañana' o 'a las 9 de la noche'.");
            return res.json({ status: "mensaje enviado" });
        }

        // Usar el día de la semana actual o el de la cita existente
        const diaSemana = estado.diaSemana ||
            (estado.citaActiva ?
                (new Date(estado.citaActiva.fecha).getDay() === 0 ? "domingo" :
                    new Date(estado.citaActiva.fecha).getDay() === 1 ? "lunes" :
                        new Date(estado.citaActiva.fecha).getDay() === 2 ? "martes" :
                            new Date(estado.citaActiva.fecha).getDay() === 3 ? "miércoles" :
                                new Date(estado.citaActiva.fecha).getDay() === 4 ? "jueves" :
                                    new Date(estado.citaActiva.fecha).getDay() === 5 ? "viernes" : "sábado") :
                "día no definido");

        const esHoraValida = validarHoraEnHorario(nuevaHora, diaSemana);
        if (!esHoraValida) {
            await enviarMensaje(numero, `❌ La hora está fuera del horario de atención del ${diaSemana}.\n🕒 Horarios válidos:\n${horarioDoctor[diaSemana].map(h => `• ${h.inicio} - ${h.fin}`).join('\n')}`);
            return res.json({ status: "mensaje enviado" });
        }

        estado.hora = nuevaHora;
        estado.paso = "confirmacion";

        // Preparar datos para el resumen
        const fecha = estado.fecha || (estado.citaActiva ? estado.citaActiva.fecha : null);
        const motivo = estado.motivo || (estado.citaActiva ? estado.citaActiva.motivo : "no definido");

        // Formatear fecha para mostrar
        let fechaBonita = "fecha no definida";
        if (fecha) {
            const fechaObj = new Date(fecha);
            fechaBonita = formatearFecha(fechaObj);
        }

        const resumen = `📋 Cita actualizada:\n📅 ${diaSemana} ${fechaBonita}\n🕒 ${nuevaHora}\n📌 ${motivo}\n\n¿Deseas hacer otro cambio?\n1️⃣ Fecha\n2️⃣ Hora\n3️⃣ Motivo\n4️⃣ Confirmar\n5️⃣ Cancelar`;

        await enviarMensaje(numero, resumen);
        return res.json({ status: "mensaje enviado" });
    }

    // Paso "modificando_motivo": el usuario está modificando el motivo
    if (estado.paso === "modificando_motivo") {
        if (!mensaje.trim()) {
            await enviarMensaje(numero, "❌ Por favor, dime el motivo de tu cita.");
            return res.json({ status: "mensaje enviado" });
        }

        estado.motivo = mensaje;
        estado.paso = "confirmacion";

        // Preparar datos para el resumen
        const fecha = estado.fecha || (estado.citaActiva ? estado.citaActiva.fecha : null);
        const hora = estado.hora || (estado.citaActiva ? estado.citaActiva.hora : "no definida");
        const dia = estado.diaSemana ||
            (estado.citaActiva && fecha ?
                (new Date(fecha).getDay() === 0 ? "domingo" :
                    new Date(fecha).getDay() === 1 ? "lunes" :
                        new Date(fecha).getDay() === 2 ? "martes" :
                            new Date(fecha).getDay() === 3 ? "miércoles" :
                                new Date(fecha).getDay() === 4 ? "jueves" :
                                    new Date(fecha).getDay() === 5 ? "viernes" : "sábado") :
                "día no definido");

        // Formatear fecha para mostrar
        let fechaBonita = "fecha no definida";
        if (fecha) {
            const fechaObj = new Date(fecha);
            fechaBonita = formatearFecha(fechaObj);
        }

        const resumen = `📋 Cita actualizada:\n📅 ${dia} ${fechaBonita}\n🕒 ${hora}\n📌 ${mensaje}\n\n¿Deseas hacer otro cambio?\n1️⃣ Fecha\n2️⃣ Hora\n3️⃣ Motivo\n4️⃣ Confirmar\n5️⃣ Cancelar`;

        await enviarMensaje(numero, resumen);
        return res.json({ status: "mensaje enviado" });
    }

    // Si llegamos aquí, es un mensaje que no encaja en ningún flujo
    await enviarMensaje(numero, "❓ No entendí tu mensaje. Si deseas agendar una cita, escribe 'hola' para comenzar de nuevo.");
    return res.json({ status: "mensaje enviado" });
}

module.exports = { handleIncomingMessage };