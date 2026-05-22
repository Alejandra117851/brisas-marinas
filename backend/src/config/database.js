/**
 * Configuración del pool de conexiones a PostgreSQL.
 * Usa el módulo `pg` con un pool reutilizable para todas las queries.
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME     || 'brisas_marinas',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 20,
    client_encoding: 'UTF8',                          // Máximo de conexiones simultáneas
    idleTimeoutMillis: 30000,         // Cierra conexiones ociosas tras 30s
    connectionTimeoutMillis: 5000,    // Falla si no se conecta en 5s
});

pool.on('connect', (client) => {
    client.query("SET client_encoding TO 'UTF8'");
});

pool.on('error', (err) => {
    console.error('[DB] Error inesperado en cliente ocioso:', err);
    process.exit(-1);
});

/**
 * Ejecuta una query SQL con parámetros.
 * @param {string} text  - Sentencia SQL con placeholders $1, $2, ...
 * @param {Array}  params - Parámetros para la query
 * @returns {Promise<pg.QueryResult>}
 */
async function query(text, params) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        if (process.env.NODE_ENV === 'development' && duration > 200) {
            console.log(`[DB] Query lenta (${duration}ms):`, text.substring(0, 100));
        }
        return result;
    } catch (err) {
        console.error('[DB] Error en query:', err.message);
        console.error('[DB] SQL:', text);
        throw err;
    }
}

/**
 * Obtiene un cliente del pool para ejecutar transacciones.
 * IMPORTANTE: liberar siempre con client.release() en bloque finally.
 */
async function getClient() {
    return await pool.connect();
}

/**
 * Helper para ejecutar varias queries en una transacción.
 * @param {Function} callback - async (client) => { ... }
 */
async function withTransaction(callback) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

module.exports = {
    pool,
    query,
    getClient,
    withTransaction,
};
