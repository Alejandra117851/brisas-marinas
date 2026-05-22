/**
 * init-db.js
 * Crea la base de datos si no existe (se conecta a 'postgres' como base maestra).
 * Uso: node database/init-db.js
 */
const { Client } = require('pg');
require('dotenv').config();

const DB_NAME = process.env.DB_NAME || 'brisas_marinas';

async function main() {
    // Conexión a la base 'postgres' (administrativa)
    const client = new Client({
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT || '5432', 10),
        database: 'postgres',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    });

    try {
        await client.connect();
        console.log('[init-db] Conectado al servidor PostgreSQL.');

        const result = await client.query(
            'SELECT 1 FROM pg_database WHERE datname = $1',
            [DB_NAME]
        );

        if (result.rowCount > 0) {
            console.log(`[init-db] La base de datos "${DB_NAME}" ya existe. No se realiza ninguna acción.`);
        } else {
            await client.query(`CREATE DATABASE "${DB_NAME}"`);
            console.log(`[init-db] Base de datos "${DB_NAME}" creada correctamente.`);
        }
    } catch (err) {
        console.error('[init-db] Error:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

main();
