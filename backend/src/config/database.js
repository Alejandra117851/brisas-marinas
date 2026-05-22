const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },

    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
    console.error('[DB] Error inesperado en cliente ocioso:', err);
    process.exit(-1);
});

async function query(text, params) {
    const start = Date.now();

    try {
        const result = await pool.query(text, params);

        const duration = Date.now() - start;

        if (duration > 200) {
            console.log(`[DB] Query lenta (${duration}ms):`, text.substring(0, 100));
        }

        return result;
    } catch (err) {
        console.error('[DB] Error en query:', err.message);
        console.error('[DB] SQL:', text);
        throw err;
    }
}

async function getClient() {
    return await pool.connect();
}

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