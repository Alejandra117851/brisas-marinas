/**
 * Controlador de autenticación.
 * Endpoints:
 *   POST /api/auth/login   - Inicia sesión
 *   GET  /api/auth/me      - Devuelve datos del usuario autenticado
 *   POST /api/auth/logout  - (opcional) invalida en el cliente
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const JWT_SECRET     = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
async function login(req, res, next) {
    try {
        const { username, password } = req.body;

        const result = await db.query(
            `SELECT id, username, password_hash, full_name, email, role, is_active
               FROM users
              WHERE username = $1`,
            [username]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({
                success: false,
                message: 'Usuario o contraseña incorrectos.'
            });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'La cuenta está desactivada. Contacta al administrador.'
            });
        }

        const passwordOk = await bcrypt.compare(password, user.password_hash);
        if (!passwordOk) {
            return res.status(401).json({
                success: false,
                message: 'Usuario o contraseña incorrectos.'
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role,
                full_name: user.full_name,
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({
            success: true,
            message: 'Inicio de sesión exitoso.',
            data: {
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    full_name: user.full_name,
                    email: user.email,
                    role: user.role,
                }
            }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/auth/me
 * Devuelve datos del usuario actual basado en el JWT.
 */
async function me(req, res, next) {
    try {
        const result = await db.query(
            `SELECT id, username, full_name, email, role, is_active, created_at
               FROM users WHERE id = $1`,
            [req.user.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/auth/change-password
 * Body: { current_password, new_password }
 */
async function changePassword(req, res, next) {
    try {
        const { current_password, new_password } = req.body;

        const result = await db.query(
            'SELECT password_hash FROM users WHERE id = $1',
            [req.user.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        }

        const ok = await bcrypt.compare(current_password, result.rows[0].password_hash);
        if (!ok) {
            return res.status(400).json({
                success: false,
                message: 'La contraseña actual es incorrecta.'
            });
        }

        const newHash = await bcrypt.hash(new_password, 10);
        await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);

        res.json({ success: true, message: 'Contraseña actualizada correctamente.' });
    } catch (err) {
        next(err);
    }
}

module.exports = { login, me, changePassword };
