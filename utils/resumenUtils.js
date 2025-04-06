const { formatearFecha, crearFechaConZonaHoraria, obtenerDiaSemana, formatearHora } = require('./dateUtils');

function generarResumenCita(estado, esConfirmacion = false) {
    try {
        // Obtener los datos de la cita (usando los valores más recientes)
        const fechaISO = estado.fecha || estado.nuevaFecha || estado.citaActiva?.fecha;
        let hora = estado.hora || estado.nuevaHora || estado.citaActiva?.hora || "no definida";
        const motivo = estado.motivo || estado.citaActiva?.motivo || "no definido";
        
        // Si no hay fecha, no podemos generar un resumen completo
        if (!fechaISO) {
            console.error("❌ Error: No se pudo generar resumen sin fecha");
            return null;
        }
        
        // Crear fecha con zona horaria correcta
        const fechaObj = crearFechaConZonaHoraria(fechaISO);
        const fechaFormateada = formatearFecha(fechaObj);
        
        // Formatear la hora si es necesario
        if (typeof hora === 'string' && hora.includes(':')) {
            hora = formatearHora(hora);
        }
        
        // Obtener día de la semana (usando el valor guardado o calculándolo)
        const diaSemana = estado.diaSemana || obtenerDiaSemana(fechaISO);
        
        // Determinar mensaje según si es para confirmación o modificación
        if (esConfirmacion) {
            return `✅ ¡Tu cita ha sido ${estado.citaActiva ? 'reagendada' : 'registrada'} con éxito!
📅 Fecha: ${diaSemana} ${fechaFormateada}
🕒 Hora: ${hora}
📌 Motivo: ${motivo}

¡Gracias por ${estado.citaActiva ? 'utilizar nuestro servicio' : 'reservar con nosotros'}! 😊`;
        } else {
            return `📋 ${estado.citaActiva ? 'Cita actualizada' : 'Tu cita'}:
📅 ${diaSemana} ${fechaFormateada}
🕒 ${hora}
📌 ${motivo}

¿Deseas hacer ${estado.citaActiva ? 'otro cambio' : 'un cambio'}?
1️⃣ Fecha
2️⃣ Hora
3️⃣ Motivo
4️⃣ Confirmar
5️⃣ Cancelar`;
        }
    } catch (error) {
        console.error("❌ Error generando resumen de cita:", error);
        return "❌ Error al generar el resumen de la cita.";
    }
}

module.exports = { generarResumenCita };
