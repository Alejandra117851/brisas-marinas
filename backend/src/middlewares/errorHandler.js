/**
 * Middleware central de manejo de errores.
 */
function errorHandler(err, req, res, next) {
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Error de validación.',
            errors: err.errors,
        });
    }

    if (err.code) {
        switch (err.code) {
            case '23505': // unique_violation
                // Mostrar detail completo para diagnosticar qué columna falla
                return res.status(409).json({
                    success: false,
                    message: 'Ya existe un registro con esos datos (valor duplicado).',
                    detail: err.detail,       // ← ej: "Key (order_number)=(ORD-...) already exists."
                    constraint: err.constraint, // ← nombre del constraint
                    table: err.table,           // ← tabla donde ocurre
                });
            case '23503':
                return res.status(409).json({
                    success: false,
                    message: 'No se puede completar la operación porque hay registros relacionados.',
                    detail: err.detail,
                });
            case '23502':
                return res.status(400).json({
                    success: false,
                    message: 'Falta un campo obligatorio.',
                    detail: err.detail,
                });
            case '23514':
                return res.status(400).json({
                    success: false,
                    message: 'Un valor enviado no cumple las restricciones del sistema.',
                    detail: err.detail,
                });
        }
    }

    console.error('[ERROR]', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Error interno del servidor.',
    });
}

function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    });
}

module.exports = { errorHandler, notFoundHandler };