/**
 * Middlewares de autenticación y autorización.
 *  - authenticate: valida el JWT enviado en el header Authorization.
 *  - authorize:    restringe el acceso a uno o varios roles.
 */
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Verifica el token JWT y adjunta los datos del usuario a req.user.
 */
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({
            success: false,
            message: 'Token de autenticación no proporcionado.'
        });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = {
            id:        payload.id,
            username:  payload.username,
            role:      payload.role,
            full_name: payload.full_name,
        };
        next();
    } catch (err) {
        const msg = err.name === 'TokenExpiredError'
            ? 'La sesión ha expirado. Inicia sesión nuevamente.'
            : 'Token inválido.';
        return res.status(401).json({ success: false, message: msg });
    }
}

/**
 * Restringe acceso al endpoint solo a roles permitidos.
 * @param  {...string} allowedRoles
 * @example router.post('/users', authorize('administrador'), ...)
 */
function authorize(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'No autenticado.' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para acceder a este recurso.'
            });
        }
        next();
    };
}

module.exports = { authenticate, authorize };
