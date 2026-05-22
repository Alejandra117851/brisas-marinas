/**
 * Controlador del módulo de Productos / Inventario.
 * - list, getById, create, update, remove
 * - getCategories
 * - adjustStock (entradas/salidas manuales)
 * - getLowStock
 */
const db = require('../config/database');

/**
 * GET /api/products
 * Query: ?search=&category=&active=&low_stock=
 */
async function list(req, res, next) {
    try {
        const { search, category, active, low_stock } = req.query;
        const conditions = [];
        const params = [];
        let idx = 1;

        if (search) {
            conditions.push(`(p.name ILIKE $${idx} OR p.code ILIKE $${idx} OR p.description ILIKE $${idx})`);
            params.push(`%${search}%`);
            idx++;
        }
        if (category) {
            conditions.push(`p.category_id = $${idx++}`);
            params.push(category);
        }
        if (active !== undefined) {
            conditions.push(`p.is_active = $${idx++}`);
            params.push(active === 'true');
        } else {
            conditions.push(`p.is_active = TRUE`);
        }
        if (low_stock === 'true') {
            conditions.push(`p.stock <= p.min_stock`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const result = await db.query(
            `SELECT p.id, p.code, p.name, p.description, p.price, p.cost,
                    p.stock, p.min_stock, p.unit, p.is_active, p.category_id,
                    c.name AS category_name,
                    p.created_at, p.updated_at
               FROM products p
               LEFT JOIN categories c ON c.id = p.category_id
               ${where}
              ORDER BY p.name ASC`,
            params
        );

        res.json({ success: true, data: result.rows });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/products/:id
 */
async function getById(req, res, next) {
    try {
        const { id } = req.params;
        const result = await db.query(
            `SELECT p.*, c.name AS category_name
               FROM products p
               LEFT JOIN categories c ON c.id = p.category_id
              WHERE p.id = $1`,
            [id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/products
 */
async function create(req, res, next) {
    try {
        const {
            code, name, description, category_id,
            price, cost, stock, min_stock, unit
        } = req.body;

        const result = await db.query(
            `INSERT INTO products
                (code, name, description, category_id, price, cost, stock, min_stock, unit)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                code || null,
                name,
                description || null,
                category_id || null,
                price,
                cost || 0,
                stock || 0,
                min_stock || 5,
                unit || 'unidad'
            ]
        );
        res.status(201).json({
            success: true,
            message: 'Producto creado correctamente.',
            data: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /api/products/:id
 */
async function update(req, res, next) {
    try {
        const { id } = req.params;
        const {
            code, name, description, category_id,
            price, cost, min_stock, unit, is_active
        } = req.body;

        const result = await db.query(
            `UPDATE products
                SET code        = COALESCE($1, code),
                    name        = COALESCE($2, name),
                    description = COALESCE($3, description),
                    category_id = COALESCE($4, category_id),
                    price       = COALESCE($5, price),
                    cost        = COALESCE($6, cost),
                    min_stock   = COALESCE($7, min_stock),
                    unit        = COALESCE($8, unit),
                    is_active   = COALESCE($9, is_active)
              WHERE id = $10
          RETURNING *`,
            [code, name, description, category_id, price, cost, min_stock, unit, is_active, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
        }
        res.json({
            success: true,
            message: 'Producto actualizado.',
            data: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
}

/**
 * PATCH /api/products/:id/stock
 * Body: { adjustment, reason } - adjustment puede ser positivo (entrada) o negativo (salida)
 */
async function adjustStock(req, res, next) {
    try {
        const { id } = req.params;
        const { adjustment, reason } = req.body;

        if (typeof adjustment !== 'number' || adjustment === 0) {
            return res.status(400).json({
                success: false,
                message: 'El ajuste debe ser un número distinto de cero.'
            });
        }

        const result = await db.query(
            `UPDATE products
                SET stock = stock + $1
              WHERE id = $2
                AND stock + $1 >= 0
          RETURNING *`,
            [adjustment, id]
        );

        if (result.rowCount === 0) {
            return res.status(400).json({
                success: false,
                message: 'No se pudo ajustar el stock. ¿Producto inexistente o ajuste mayor al disponible?'
            });
        }

        res.json({
            success: true,
            message: `Stock ajustado en ${adjustment} unidades. ${reason ? '(' + reason + ')' : ''}`,
            data: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
}

/**
 * DELETE /api/products/:id   (borrado lógico)
 */
async function remove(req, res, next) {
    try {
        const { id } = req.params;
        const result = await db.query(
            'UPDATE products SET is_active = FALSE WHERE id = $1 RETURNING id',
            [id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
        }
        res.json({ success: true, message: 'Producto desactivado.' });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/products/low-stock
 */
async function getLowStock(req, res, next) {
    try {
        const result = await db.query(
            `SELECT * FROM v_low_stock_products`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/categories
 */
async function getCategories(req, res, next) {
    try {
        const result = await db.query(
            'SELECT * FROM categories WHERE is_active = TRUE ORDER BY name'
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/categories
 */
async function createCategory(req, res, next) {
    try {
        const { name, description } = req.body;
        const result = await db.query(
            `INSERT INTO categories (name, description)
             VALUES ($1, $2)
             RETURNING *`,
            [name, description || null]
        );
        res.status(201).json({
            success: true,
            message: 'Categoría creada.',
            data: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    list, getById, create, update, adjustStock, remove,
    getLowStock, getCategories, createCategory
};
