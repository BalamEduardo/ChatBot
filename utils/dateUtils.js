const chrono = require('chrono-node');
const { convertirTextoANumeros, convertirTextoANumerosHora } = require('./numberUtils'); 

function formatearFecha(fecha) {
    if (!(fecha instanceof Date) || isNaN(fecha)) {
        console.error("❌ Error: `formatearFecha` recibió un valor no válido:", fecha);
        return null; // Evita fallos si la fecha no es válida
    }

    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0'); // Meses van de 0 a 11
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
}


function obtenerFechaDesdeTexto(texto) {
    const textoConNumeros = convertirTextoANumeros(texto);
    const fecha = chrono.es.parseDate(textoConNumeros);
    
    if (!fecha || isNaN(fecha.getTime())) {
        console.error("❌ Ingresa una fecha valida:", texto);
        return null;
    }

    return fecha; // Retorna un objeto Date válido
}


function obtenerHoraDesdeTexto(texto) {
    const textoConNumeros = convertirTextoANumerosHora(texto); // Convierte "cinco" a "5"

    // Detectar si el texto tiene AM/PM o expresiones como "mañana", "tarde", "noche"
    
    const periodoDetectado = /(am|pm|a\.m\.|p\.m\.|mañana|tarde|noche|de la mañana|de la tarde|de la noche|del día|del mediodía|por la mañana|por la tarde|por la noche)/.test(texto.toLowerCase());
    
    // Expresión regular para detectar horas en diferentes formatos
    const regexHora = /(\d{1,2})\s*(?:[:h]?\s*(\d{2})?)?\s*(am|pm|a\.m\.|p\.m\.|de la mañana|de la tarde|de la noche)?/i;
    const match = textoConNumeros.match(regexHora);

    if (!match) return null;

    if (!periodoDetectado) {
        return "FALTA_PERIODO"; // El usuario no especificó si es mañana o tarde/noche
    }

    let horas = parseInt(match[1]);
    let minutos = match[2] ? parseInt(match[2]) : 0;
    let periodo = match[3] ? match[3].toLowerCase() : null;

    if (isNaN(horas) || isNaN(minutos)) return null; // ✅ Verifica que horas y minutos sean válidos

    // Ajustar según el periodo AM/PM
    if (periodo) {
        if (periodo.includes("p") || periodo.includes("tarde") || periodo.includes("noche")) {
            if (horas < 12) horas += 12; // Convertir a formato 24h si es PM
        } else if (horas === 12) {
            horas = 0; // Convertir 12 AM a 00 en formato 24h
        }
    }

    // Convertir a formato 12 horas (AM/PM)
    const ampm = horas >= 12 ? "PM" : "AM";
    horas = horas % 12 || 12; // Convertir 00 a 12 para AM/PM
    minutos = minutos.toString().padStart(2, "0");

    return `${horas}:${minutos} ${ampm}`;
}

module.exports = { obtenerFechaDesdeTexto, obtenerHoraDesdeTexto, formatearFecha };
