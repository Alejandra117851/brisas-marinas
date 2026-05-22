/**
 * Controlador del módulo de Usuarios.
 * Solo accesible por el rol "administrador".
 */
const bcrypt = require('bcryptjs');
const db = require('../config/database');

/**
 * GET /api/users
 */
async function list(req, res, next) {
    try {
        const { role, active, search } = req.query;
        const conditions = [];
        const params = [];
        let idx = 1;

        if (role) {
            conditions.push(`role = $${idx++}`);
            params.push(role);
        }
        if (active !== undefined) {
            conditions.push(`is_active = $${idx++}`);
            params.push(active === 'true');
        }
        if (search) {
            conditions.push(`(username ILIKE $${idx} OR full_name ILIKE $${idx} OR email ILIKE $${idx})`);
            params.push(`%${search}%`);
            idx++;
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const result = await db.query(
            `SELECT id, username, full_name, email, role, is_active, created_at, updated_at
               FROM users
               ${where}
              ORDER BY created_at DESC`,
            params
        );

        res.json({ success: true, data: result.rows });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/users/:id
 */
async function getById(req, res, next) {
    try {
        const { id } = req.params;
        const result = await db.query(
            `SELECT id, username, full_name, email, role, is_active, created_at, updated_at
               FROM users WHERE id = $1`,
            [id]
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
 * POST /api/users
 * Body: { username, password, full_name, email, role }
 */
async function create(req, res, next) {
    try {
        const { username, password, full_name, email, role } = req.body;
        const password_hash = await bcrypt.hash(password, 10);

        const result = await db.query(
            `INSERT INTO users (username, password_hash, full_name, email, role)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, username, full_name, email, role, is_active, created_at`,
            [username, password_hash, full_name, email || null, role]
        );

        res.status(201).json({
            success: true,
            message: 'Usuario creado correctamente.',
            data: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /api/users/:id
 * Body: { full_name, email, role, is_active }
 */
async function update(req, res, next) {
    try {
        const { id } = req.params;
        const { username, full_name, email, role, is_active } = req.body;
        
        const result = await db.query(
    `UPDATE users
        SET username  = COALESCE($1, username),
            full_name = COALESCE($2, full_name),
            email     = COALESCE($3, email),
            role      = COALESCE($4, role),
            is_active = COALESCE($5, is_active)
      WHERE id = $6
  RETURNING id, username, full_name, email, role, is_active, created_at, updated_at`,
    [username, full_name, email, role, is_active, id]
);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        }
        res.json({
            success: true,
            message: 'Usuario actualizado.',
            data: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /api/users/:id/reset-password
 * Body: { new_password }
 * Solo el administrador puede resetear contraseñas.
 */
async function resetPassword(req, res, next) {
    try {
        const { id } = req.params;
        const { new_password } = req.body;
        const hash = await bcrypt.hash(new_password, 10);

        const result = await db.query(
            'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id',
            [hash, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        }
        res.json({ success: true, message: 'Contraseña restablecida correctamente.' });
    } catch (err) {
        next(err);
    }
}

/**
 * DELETE /api/users/:id
 * Borrado lógico (is_active = false). No permite borrarse a sí mismo.
 */
async function remove(req, res, next) {
    try {
        const { id } = req.params;

        if (parseInt(id, 10) === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'No puedes desactivar tu propia cuenta.'
            });
        }

        const result = await db.query(
            'UPDATE users SET is_active = FALSE WHERE id = $1 RETURNING id',
            [id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        }
        res.json({ success: true, message: 'Usuario desactivado correctamente.' });
    } catch (err) {
        next(err);
    }
}

module.exports = { list, getById, create, update, resetPassword, remove };
