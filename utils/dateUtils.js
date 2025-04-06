const chrono = require('chrono-node');
const { convertirTextoANumeros, convertirTextoANumerosHora } = require('./numberUtils'); 

// Array de días de la semana centralizado
const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function formatearFecha(fecha) {
    try {
        // Verificar si es una fecha válida
        if (!fecha || !(fecha instanceof Date) || isNaN(fecha.getTime())) {
            console.error("❌ Error: `formatearFecha` recibió un valor no válido:", fecha);
            return "Fecha no disponible"; // Devolver un texto en lugar de null
        }

        // Forzar la interpretación de la fecha en la zona horaria local
        const opciones = { 
            timeZone: 'America/Mexico_City', 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        };
        
        return fecha.toLocaleDateString('es-MX', opciones);
    } catch (error) {
        console.error("❌ Error al formatear fecha:", error, fecha);
        return "Fecha no disponible";
    }
}

// Nueva función para crear fechas con zona horaria consistente
function crearFechaConZonaHoraria(fechaISO) {
    // Casos de error o valores nulos
    if (!fechaISO) {
        console.error("❌ Error: crearFechaConZonaHoraria recibió un valor nulo o indefinido");
        return new Date(); // Devolver la fecha actual como fallback
    }
    
    try {
        // Si es un objeto Date, devolverlo directamente
        if (fechaISO instanceof Date) {
            return fechaISO;
        }
        
        // Si la fecha ya tiene formato completo ISO con T o Z
        if (typeof fechaISO === 'string' && (fechaISO.includes('T') || fechaISO.includes('Z'))) {
            // Crear un nuevo objeto Date a partir de la cadena ISO
            const fecha = new Date(fechaISO);
            
            // Verificar que la fecha sea válida
            if (isNaN(fecha.getTime())) {
                console.error("❌ Error: La fecha ISO no es válida:", fechaISO);
                return new Date(); // Devolver fecha actual como fallback
            }
            
            return fecha;
        }
        
        // Si es formato YYYY-MM-DD sin hora, añadir zona horaria de México
        return new Date(`${fechaISO}T00:00:00-06:00`);
    } catch (error) {
        console.error("❌ Error al procesar fecha:", error, fechaISO);
        return new Date(); // Devolver fecha actual como fallback
    }
}

// Nueva función para obtener el día de la semana de forma consistente
function obtenerDiaSemana(fecha) {
    const fechaObj = crearFechaConZonaHoraria(fecha);
    return DIAS_SEMANA[fechaObj.getDay()];
}

function obtenerFechaDesdeTexto(texto) {
    const textoConNumeros = convertirTextoANumeros(texto);
    const fecha = chrono.es.parseDate(textoConNumeros);
    
    if (!fecha || isNaN(fecha.getTime())) {
        console.error("❌ Error al interpretar la fecha:", texto);
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

function formatearHora(horaString) {
    // Si la hora ya tiene formato AM/PM, devolverla tal cual
    if (horaString.includes('AM') || horaString.includes('PM')) {
        return horaString;
    }
    
    // Extraer horas, minutos, segundos
    const match = horaString.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return horaString; // Si no podemos parsear, devolver original
    
    let horas = parseInt(match[1]);
    const minutos = match[2];
    
    // Determinar AM/PM
    const periodo = horas >= 12 ? 'PM' : 'AM';
    
    // Convertir a formato 12 horas
    horas = horas % 12 || 12; // 0 o 12 se convierte en 12
    
    return `${horas}:${minutos} ${periodo}`;
}

module.exports = { 
    obtenerFechaDesdeTexto, 
    obtenerHoraDesdeTexto, 
    formatearFecha, 
    crearFechaConZonaHoraria, 
    obtenerDiaSemana,
    formatearHora,  // Añadir la nueva función
    DIAS_SEMANA 
};
