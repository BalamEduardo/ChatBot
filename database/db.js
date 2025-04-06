require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Necesario para conexiones en la nube
});

// Función para probar la conexión a la base de datos
async function testConnection() {
    try {
        await client.connect();
        console.log("✅ Conexión a Supabase PostgreSQL exitosa.");
    } catch (error) {
        console.error("❌ Error conectando a Supabase:", error);
    }
}

// Función para guardar citas en la base de datos
async function guardarCita(cita) {
    try {
        const query = `INSERT INTO citas (nombre, telefono, fecha, hora, motivo) 
                       VALUES ($1, $2, $3, $4, $5) RETURNING *;`;
        const values = [cita.nombre, cita.telefono, cita.fecha, cita.hora, cita.motivo];
        const result = await client.query(query, values);

        console.log("✅ Cita guardada en la base de datos:", result.rows[0]);
    } catch (error) {
        console.error("❌ Error guardando la cita en la base de datos:", error);
    }
}

// Función para reagendar una cita en la base de datos
async function reagendarCita(id, nuevaFecha, nuevaHora) {
    try {
        const query = `UPDATE citas SET fecha = $1, hora = $2 WHERE id = $3`;
        await client.query(query, [nuevaFecha, nuevaHora, id]);
        console.log("🔄 Cita     reagendada");
        return true;
    } catch (error) {
        console.error("❌ Error al reagendar cita:", error);
        return false;
    }
}



// Función para obtener la cita activa de un usuario por su número de teléfono
async function obtenerCitaActivaPorTelefono(telefono) {
    try {
        const query = `
            SELECT * FROM citas
            WHERE telefono = $1 AND estado = 'pendiente'
            ORDER BY fecha ASC, hora ASC
            LIMIT 1;
        `;
        const { rows } = await client.query(query, [telefono]);
        return rows[0] || null;
    } catch (error) {
        console.error("❌ Error consultando citas activas:", error);
        return null;
    }
}

async function cancelarCitaPorId(id) {
    try {
        const query = `UPDATE citas SET estado = 'cancelada' WHERE id = $1`;
        await client.query(query, [id]);
        console.log("❌ Cita cancelada en la base de datos.");
        return true;
    } catch (error) {
        console.error("❌ Error al cancelar la cita:", error);
        return false;
    }
}

// Ejecutar la prueba de conexión cuando el servidor inicie
testConnection();

module.exports = { guardarCita, obtenerCitaActivaPorTelefono, cancelarCitaPorId, reagendarCita };
