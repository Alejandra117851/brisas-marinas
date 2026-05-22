const db = require('../config/database');
 
// GET /api/tables — lista todas las mesas con su estado
exports.list = async (req, res, next) => {
    try {
        const { rows } = await db.query(
            `SELECT t.*, o.id AS current_order_id, o.order_number
             FROM tables t
             LEFT JOIN orders o ON o.table_id = t.id AND o.status = 'pendiente'
             ORDER BY t.label ASC`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        next(err);
    }
};
 
// PATCH /api/tables/:id/occupy — marcar mesa como ocupada
exports.occupy = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { rows } = await db.query(
            `UPDATE tables SET is_occupied = TRUE WHERE id = $1 RETURNING *`,
            [id]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'Mesa no encontrada.' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        next(err);
    }
};
 
// PATCH /api/tables/:id/free — liberar mesa
exports.free = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { rows } = await db.query(
            `UPDATE tables SET is_occupied = FALSE WHERE id = $1 RETURNING *`,
            [id]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'Mesa no encontrada.' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        next(err);
    }
};