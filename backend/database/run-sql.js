/**
 * run-sql.js
 * Ejecuta un archivo SQL contra la base de datos del proyecto.
 * Uso: node database/run-sql.js <archivo.sql>
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

async function main() {
    const fileName = process.argv[2];
    if (!fileName) {
        console.error('[run-sql] Falta el nombre del archivo SQL.');
        console.error('         Uso: node database/run-sql.js <archivo.sql>');
        process.exit(1);
    }

    const sqlPath = path.join(__dirname, fileName);
    if (!fs.existsSync(sqlPath)) {
        console.error(`[run-sql] No se encontró el archivo: ${sqlPath}`);
        process.exit(1);
    }

    const sql = fs.readFileSync(sqlPath, 'utf-8');

    const client = new Client({
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME     || 'brisas_marinas',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    });

    try {
        await client.connect();
        console.log(`[run-sql] Ejecutando: ${fileName}`);
        await client.query(sql);
        console.log(`[run-sql] ✓ ${fileName} ejecutado correctamente.`);
    } catch (err) {
        console.error('[run-sql] Error:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

main();
