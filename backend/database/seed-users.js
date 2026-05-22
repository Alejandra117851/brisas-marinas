/**
 * seed-users.js
 * Crea los usuarios iniciales con contraseñas hasheadas mediante bcrypt.
 * Uso: node database/seed-users.js
 */
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
require('dotenv').config();

const SALT_ROUNDS = 10;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Marcador usado cuando los emails fueron redactados en el codigo fuente.
// Si detectamos este patron, guardamos NULL (la columna email es UNIQUE pero
// admite multiples NULLs, asi que no hay colision).
const REDACTED_PLACEHOLDER =
    String.fromCharCode(91) + 'email' + String.fromCharCode(32) + 'protected' + String.fromCharCode(93);

function cleanEmail(value) {
    if (!value) return null;
    const v = String(value).trim();
    if (v === REDACTED_PLACEHOLDER) return null;
    if (!v.includes('@')) return null;
    return v;
}

const users = [
    {
        username:  process.env.ADMIN_USERNAME  || 'admin',
        password:  ADMIN_PASSWORD,
        full_name: process.env.ADMIN_FULL_NAME || 'Baldura María Petro Pérez',
        email:     cleanEmail(process.env.ADMIN_EMAIL),
        role:      'administrador',
    },
    {
        username:  'cajero1',
        password:  ADMIN_PASSWORD,
        full_name: 'María José Cajero',
        email:     null,
        role:      'cajero',
    },
    {
        username:  'empleado1',
        password:  ADMIN_PASSWORD,
        full_name: 'Pedro Empleado',
        email:     null,
        role:      'empleado',
    },
];

async function main() {
    const client = new Client({
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME     || 'brisas_marinas',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    });

    const SQL = [
        'INSERT INTO users (username, password_hash, full_name, email, role)',
        'VALUES ($1, $2, $3, $4, $5)',
        'ON CONFLICT (username) DO UPDATE',
        '  SET password_hash = EXCLUDED.password_hash,',
        '      full_name     = EXCLUDED.full_name,',
        '      email         = EXCLUDED.email,',
        '      role          = EXCLUDED.role',
    ].join('\n');

    try {
        await client.connect();
        console.log('[seed-users] Insertando usuarios iniciales...');

        for (const u of users) {
            const hash = await bcrypt.hash(u.password, SALT_ROUNDS);
            await client.query(SQL, [u.username, hash, u.full_name, u.email, u.role]);
            console.log('  ✓ ' + u.username.padEnd(12) + ' (' + u.role + ')');
        }

        console.log('\n[seed-users] ✓ Usuarios creados/actualizados correctamente.');
        console.log('[seed-users] Contrasena por defecto para todos: "' + ADMIN_PASSWORD + '"');
        console.log('[seed-users] IMPORTANTE: cambia las contrasenas tras el primer ingreso.\n');
    } catch (err) {
        console.error('[seed-users] Error:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

main();
