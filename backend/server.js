/**
 * server.js
 * Punto de entrada de la aplicación. Levanta el servidor HTTP.
 */
require('dotenv').config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('[server] ✗ JWT_SECRET no está definido o es demasiado corto (mínimo 32 caracteres).');
    console.error('         Configúralo en backend/.env antes de arrancar el servidor.');
    process.exit(1);
}

const app = require('./src/app');
const db  = require('./src/config/database');

const PORT = parseInt(process.env.PORT || '3000', 10);

async function start() {
    try {
        // Verificar conexión a la BD antes de iniciar
        await db.query('SELECT 1');
        console.log('[server] ✓ Conexión a PostgreSQL exitosa.');

        app.listen(PORT, () => {
            console.log('========================================================');
            console.log(`  Brisas Marinas API  •  http://localhost:${PORT}`);
            console.log(`  Entorno: ${process.env.NODE_ENV || 'development'}`);
            console.log(`  Health:  http://localhost:${PORT}/api/health`);
            console.log('========================================================');
        });
    } catch (err) {
        console.error('[server] ✗ Error al iniciar:', err.message);
        console.error('         Verifica que PostgreSQL esté corriendo y que las variables');
        console.error('         de entorno en .env sean correctas.');
        process.exit(1);
    }
}

// Manejo de cierre limpio
process.on('SIGTERM', () => {
    console.log('[server] SIGTERM recibido. Cerrando…');
    process.exit(0);
});

process.on('unhandledRejection', (reason) => {
    console.error('[server] Unhandled rejection:', reason);
});

start();
