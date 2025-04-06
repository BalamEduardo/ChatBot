/**
 * Gestiona los timeouts para detectar inactividad en las conversaciones
 */
const { enviarMensaje } = require('../controllers/messageHandler');
const { guardarConversacionInactiva } = require('./flowManager');

// Constantes de tiempo
const TIEMPO_ADVERTENCIA = 3 * 60 * 1000; // 3 minutos
const TIEMPO_FINALIZACION = 5 * 60 * 1000; // 5 minutos

// Almacena los timeouts activos por número de teléfono
const timeoutsAdvertencia = {};
const timeoutsFinalizacion = {};

/**
 * Maneja el timeout para un usuario específico
 * Esta función consolida la lógica de timeout en un solo lugar
 * @param {string} numero - Número de teléfono del usuario
 */
function manejarTimeout(numero) {
    configurarTimeout(
        numero,
        TIEMPO_ADVERTENCIA,
        TIEMPO_FINALIZACION,
        async () => {
            // Advertencia de inactividad
            await enviarMensaje(numero, "⏳ Parece que estás inactivo. Si no respondes en 2 minutos, el chat se cerrará automáticamente. Escribe 'continuar' para seguir donde quedaste o 'hola' para reiniciar.");
            console.log(`⚠️ Advertencia enviada a ${numero}`);
        },
        async () => {
            // Finalización por inactividad
            // Este callback debe tener acceso al estado de la conversación
            // Lo ideal sería obtenerlo del módulo flowManager
            const conversacion = require('./flowManager').getConversacion(numero);
            
            if (conversacion) {
                // Guardar estado para posible recuperación
                guardarConversacionInactiva(numero, conversacion);
                require('./flowManager').deleteConversacion(numero);
                
                await enviarMensaje(numero, `⏳ Has estado inactivo por un tiempo. Para continuar con tu cita:
1️⃣ Escribe "continuar" - Para seguir desde donde quedaste
2️⃣ Escribe "hola" - Para empezar de nuevo`);
                
                console.log(`⏳ Conversación con ${numero} pausada por inactividad.`);
            }
        }
    );
}

/**
 * Configura los timeouts de advertencia y finalización para un usuario
 * @param {string} numero - Número de teléfono del usuario
 * @param {number} tiempoAdvertencia - Tiempo en ms para la advertencia
 * @param {number} tiempoFinalizacion - Tiempo en ms para la finalización
 * @param {Function} callbackAdvertencia - Función a ejecutar como advertencia
 * @param {Function} callbackFinalizacion - Función a ejecutar al finalizar
 */
function configurarTimeout(numero, tiempoAdvertencia, tiempoFinalizacion, callbackAdvertencia, callbackFinalizacion) {
    // Limpiar timeouts previos
    limpiarTimeout(numero);
    
    // Configurar nuevo timeout de advertencia
    timeoutsAdvertencia[numero] = setTimeout(async () => {
        try {
            console.log(`⏳ Timeout de advertencia alcanzado para ${numero}`);
            await callbackAdvertencia();
            
            // Configurar timeout de finalización
            timeoutsFinalizacion[numero] = setTimeout(async () => {
                try {
                    console.log(`⏳ Timeout de finalización alcanzado para ${numero}`);
                    await callbackFinalizacion();
                    delete timeoutsAdvertencia[numero];
                    delete timeoutsFinalizacion[numero];
                } catch (error) {
                    console.error(`❌ Error en timeout de finalización para ${numero}:`, error);
                }
            }, tiempoFinalizacion - tiempoAdvertencia);
            
        } catch (error) {
            console.error(`❌ Error en timeout de advertencia para ${numero}:`, error);
        }
    }, tiempoAdvertencia);
    
    console.log(`⏱️ Timeouts configurados para ${numero}: advertencia en ${tiempoAdvertencia/1000}s, finalización en ${tiempoFinalizacion/1000}s`);
}

/**
 * Limpia los timeouts activos para un usuario
 * @param {string} numero - Número de teléfono del usuario
 */
function limpiarTimeout(numero) {
    if (timeoutsAdvertencia[numero]) {
        clearTimeout(timeoutsAdvertencia[numero]);
        delete timeoutsAdvertencia[numero];
    }
    
    if (timeoutsFinalizacion[numero]) {
        clearTimeout(timeoutsFinalizacion[numero]);
        delete timeoutsFinalizacion[numero];
    }
    
    console.log(`⏱️ Timeouts limpiados para ${numero}`);
}

module.exports = {
    configurarTimeout,
    limpiarTimeout,
    manejarTimeout  // Exportamos la nueva función
};