const { formatearFecha } = require('./dateUtils');

function generarResumenCita(estado) {
    const fechaRaw = estado.fecha || estado.nuevaFecha || estado.citaActiva?.fecha;
    const hora = estado.hora || estado.nuevaHora || estado.citaActiva?.hora;
    const motivo = estado.motivo || estado.citaActiva?.motivo;
    const dia = estado.diaSemana || "día no definido";

    const fechaBonita = formatearFecha(new Date(fechaRaw));

    return `📋 Cita actualizada:
📅 ${dia} ${fechaBonita}
🕒 ${hora}
📌 ${motivo}

¿Deseas hacer otro cambio?
1️⃣ Fecha
2️⃣ Hora
3️⃣ Motivo
4️⃣ Confirmar
5️⃣ Cancelar`;
}

module.exports = { generarResumenCita };
