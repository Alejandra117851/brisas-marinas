/**
 * app.js
 * Configuración principal de la aplicación Express.
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');

const app = express();

// ----------------------------------------------------------------------------
// Configuración de seguridad y utilidades
// ----------------------------------------------------------------------------
app.use(helmet({
    contentSecurityPolicy: false, // permitimos que el frontend cargue desde otro origen
}));

// CORS: orígenes configurables desde .env
const allowedOrigins = (process.env.CORS_ORIGINS || '*')
    .split(',')
    .map(s => s.trim());

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
    credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
    app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Rate limiting global
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max:      parseInt(process.env.RATE_LIMIT_MAX || '200', 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Demasiadas peticiones. Intenta más tarde.' },
});
app.use('/api', limiter);

// ----------------------------------------------------------------------------
// Healthcheck
// ----------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        service: 'brisas-marinas-api',
        timestamp: new Date().toISOString(),
    });
});

// ----------------------------------------------------------------------------
// Rutas de la API
// ----------------------------------------------------------------------------
app.use('/api/auth',       require('./routes/auth.routes'));
app.use('/api/users',      require('./routes/users.routes'));
app.use('/api/products',   require('./routes/products.routes'));
app.use('/api/categories', require('./routes/categories.routes'));
app.use('/api/sales',      require('./routes/sales.routes'));
app.use('/api/reports',    require('./routes/reports.routes'));
app.use('/api/tables',     require('./routes/tables.routes')); 
app.use('/api/orders',     require('./routes/orders.routes'));
// ----------------------------------------------------------------------------
// Servir el frontend estático (opcional, útil en producción)
// ----------------------------------------------------------------------------
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(FRONTEND_DIR));

// SPA fallback: cualquier ruta que no sea /api devuelve el index.html
app.get(/^(?!\/api).*/, (req, res, next) => {
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'), (err) => {
        if (err) next();
    });
});

// ----------------------------------------------------------------------------
// 404 y manejo de errores
// ----------------------------------------------------------------------------
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
