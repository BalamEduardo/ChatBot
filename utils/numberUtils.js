// Convierte números escritos en palabras a dígitos
function convertirTextoANumeros(texto) {
    const numeros = {
        "uno": "1", "dos": "2", "tres": "3", "cuatro": "4", "cinco": "5",
        "seis": "6", "siete": "7", "ocho": "8", "nueve": "9", "diez": "10",
        "once": "11", "doce": "12", "trece": "13", "catorce": "14", "quince": "15",
        "dieciséis": "16", "diecisiete": "17", "dieciocho": "18", "diecinueve": "19", "veinte": "20",
        "veintiuno": "21", "veintidós": "22", "veintitrés": "23", "veinticuatro": "24",
        "veinticinco": "25", "veintiséis": "26", "veintisiete": "27", "veintiocho": "28",
        "veintinueve": "29", "treinta": "30", "treinta y uno": "31"
    };

    return texto.replace(/\b(?:uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciséis|diecisiete|dieciocho|diecinueve|veinte|veintiuno|veintidós|veintitrés|veinticuatro|veinticinco|veintiséis|veintisiete|veintiocho|veintinueve|treinta|treinta y uno)\b/gi,
        (coincidencia) => numeros[coincidencia.toLowerCase()]);
}

// Convierte horas en texto a números
function convertirTextoANumerosHora(texto) {
    const numeros = {
        "uno": "1", "dos": "2", "tres": "3", "cuatro": "4", "cinco": "5",
        "seis": "6", "siete": "7", "ocho": "8", "nueve": "9", "diez": "10",
        "once": "11", "doce": "12"
    };

    return texto.replace(/\b(?:uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b/gi,
        (coincidencia) => numeros[coincidencia.toLowerCase()]);
}

module.exports = { convertirTextoANumeros, convertirTextoANumerosHora };
