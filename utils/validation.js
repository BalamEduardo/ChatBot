const { horarioDoctor } = require("../config/schedule"); // Importamos el horario

// Convierte hora en formato AM/PM a 24 horas
function convertirHoraA24Horas(horaAMPM) {
    const match = horaAMPM.match(/(\d{1,2}):(\d{2}) (AM|PM)/);
    if (!match) return null;

    let horas = parseInt(match[1]);
    let minutos = parseInt(match[2]);
    let periodo = match[3];

    if (periodo === "PM" && horas !== 12) horas += 12;
    if (periodo === "AM" && horas === 12) horas = 0;

    return horas * 60 + minutos; // Convertimos a minutos totales en el día
}

// Valida si la hora está dentro del horario del doctor
function validarHoraEnHorario(horaTexto, diaSemana) {
    const horaEnMinutos = convertirHoraA24Horas(horaTexto);
    if (!horaEnMinutos) return false;

    const horarioDia = horarioDoctor[diaSemana];
    return horarioDia.some(h => {
        const inicio = convertirHoraA24Horas(h.inicio);
        const fin = convertirHoraA24Horas(h.fin);
        return horaEnMinutos >= inicio && horaEnMinutos <= fin;
    });
}

module.exports = { convertirHoraA24Horas, validarHoraEnHorario };
