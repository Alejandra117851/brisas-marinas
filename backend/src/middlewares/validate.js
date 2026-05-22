/**
 * Recoge los errores de express-validator y los devuelve como respuesta 400.
 * Se usa al final de cada array de validaciones de ruta.
 */
const { validationResult } = require('express-validator');

function validate(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Datos inválidos.',
            errors: errors.array().map(e => ({
                field: e.path,
                message: e.msg,
            })),
        });
    }
    next();
}

module.exports = { validate };
