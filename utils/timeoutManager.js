const timeouts = {}; // Objeto para almacenar los temporizadores por usuario

// Configura un timeout para un usuario
function configurarTimeout(numero, tiempo, onTimeout) {
    if (timeouts[numero]) {
        clearTimeout(timeouts[numero]); // Reinicia el timeout si ya existe
    }

    timeouts[numero] = setTimeout(() => {
        delete timeouts[numero]; // Elimina el timeout del objeto
        onTimeout(); // Ejecuta la función de timeout
    }, tiempo);
}

// Limpia el timeout de un usuario
function limpiarTimeout(numero) {
    if (timeouts[numero]) {
        clearTimeout(timeouts[numero]);
        delete timeouts[numero];
    }
}

module.exports = { configurarTimeout, limpiarTimeout };