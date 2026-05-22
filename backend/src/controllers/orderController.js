/**
 * orderController.js
 * Gestión de pedidos pendientes por mesa.
 */
const db = require('../config/database');

// Genera número de pedido: ORD-YYYYMMDD-XXXX
// Usa el MAX del sufijo secuencial del día para evitar duplicados
// aunque haya pedidos cancelados, pagados, o múltiples pedidos simultáneos.
async function generateOrderNumber() {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `ORD-${today}-`;

    const { rows } = await db.query(
        `SELECT COALESCE(MAX(CAST(RIGHT(order_number, 4) AS INTEGER)), 0) AS max_seq
         FROM orders
         WHERE order_number LIKE $1`,
        [`${prefix}%`]
    );

    const seq = String(parseInt(rows[0].max_seq, 10) + 1).padStart(4, '0');
    return `${prefix}${seq}`;
}

// GET /api/orders — lista pedidos (filtro por status)
exports.list = async (req, res, next) => {
    try {
        const { status = 'pendiente' } = req.query;
        const { rows } = await db.query(
            `SELECT o.*, t.label AS table_label, u.full_name AS user_name
             FROM orders o
             JOIN tables t ON t.id = o.table_id
             JOIN users u ON u.id = o.user_id
             WHERE o.status = $1
             ORDER BY o.created_at DESC`,
            [status]
        );
        for (const order of rows) {
            const { rows: items } = await db.query(
                `SELECT * FROM order_items WHERE order_id = $1 ORDER BY id`,
                [order.id]
            );
            order.items = items;
        }
        res.json({ success: true, data: rows });
    } catch (err) {
        next(err);
    }
};

// GET /api/orders/:id
exports.getById = async (req, res, next) => {
    try {
        const { rows } = await db.query(
            `SELECT o.*, t.label AS table_label, u.full_name AS user_name
             FROM orders o
             JOIN tables t ON t.id = o.table_id
             JOIN users u ON u.id = o.user_id
             WHERE o.id = $1`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });
        const order = rows[0];
        const { rows: items } = await db.query(
            `SELECT * FROM order_items WHERE order_id = $1 ORDER BY id`,
            [order.id]
        );
        order.items = items;
        res.json({ success: true, data: order });
    } catch (err) {
        next(err);
    }
};

// POST /api/orders — crear pedido pendiente
exports.create = async (req, res, next) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const { table_id, items, notes } = req.body;
        const user_id = req.user.id;

        const { rows: tableRows } = await client.query(
            `SELECT * FROM tables WHERE id = $1`, [table_id]
        );
        if (!tableRows.length) throw Object.assign(new Error('Mesa no encontrada.'), { status: 404 });
        if (tableRows[0].is_occupied) throw Object.assign(new Error('La mesa ya está ocupada.'), { status: 409 });

        let subtotal = 0;
        const enrichedItems = [];
        for (const item of items) {
            const { rows: pRows } = await client.query(
                `SELECT id, name, price, stock FROM products WHERE id = $1 AND is_active = TRUE`,
                [item.product_id]
            );
            if (!pRows.length) throw new Error(`Producto ${item.product_id} no encontrado.`);
            const product = pRows[0];
            if (product.stock < item.quantity) throw new Error(`Stock insuficiente para "${product.name}".`);
            const lineSubtotal = Number(product.price) * item.quantity;
            subtotal += lineSubtotal;
            enrichedItems.push({ ...item, product, lineSubtotal });
        }

        const order_number = await generateOrderNumber();

        const { rows: orderRows } = await client.query(
            `INSERT INTO orders (order_number, table_id, user_id, subtotal, total, notes)
             VALUES ($1, $2, $3, $4, $4, $5) RETURNING *`,
            [order_number, table_id, user_id, subtotal, notes || null]
        );
        const order = orderRows[0];

        for (const item of enrichedItems) {
            await client.query(
                `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, subtotal)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [order.id, item.product_id, item.product.name, item.quantity, item.product.price, item.lineSubtotal]
            );
            await client.query(
                `UPDATE products SET stock = stock - $1 WHERE id = $2`,
                [item.quantity, item.product_id]
            );
        }

        await client.query(`UPDATE tables SET is_occupied = TRUE WHERE id = $1`, [table_id]);
        await client.query('COMMIT');

        const { rows: finalItems } = await db.query(
            `SELECT * FROM order_items WHERE order_id = $1`, [order.id]
        );
        order.items = finalItems;
        order.table_label = tableRows[0].label;

        res.status(201).json({ success: true, data: order });
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
};

// POST /api/orders/:id/add-items — agregar más productos a un pedido pendiente
exports.addItems = async (req, res, next) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const { id } = req.params;
        const { items } = req.body;

        const { rows: orderRows } = await client.query(
            `SELECT * FROM orders WHERE id = $1 AND status = 'pendiente'`, [id]
        );
        if (!orderRows.length) throw Object.assign(new Error('Pedido no encontrado o ya procesado.'), { status: 404 });
        const order = orderRows[0];

        let extraSubtotal = 0;
        const enrichedItems = [];

        for (const item of items) {
            const { rows: pRows } = await client.query(
                `SELECT id, name, price, stock FROM products WHERE id = $1 AND is_active = TRUE`,
                [item.product_id]
            );
            if (!pRows.length) throw new Error(`Producto ${item.product_id} no encontrado.`);
            const product = pRows[0];
            if (product.stock < item.quantity) throw new Error(`Stock insuficiente para "${product.name}".`);
            const lineSubtotal = Number(product.price) * item.quantity;
            extraSubtotal += lineSubtotal;
            enrichedItems.push({ ...item, product, lineSubtotal });
        }

        for (const item of enrichedItems) {
            const { rows: existing } = await client.query(
                `SELECT * FROM order_items WHERE order_id = $1 AND product_id = $2`,
                [id, item.product_id]
            );
            if (existing.length) {
                const newQty      = existing[0].quantity + item.quantity;
                const newSubtotal = Number(existing[0].unit_price) * newQty;
                await client.query(
                    `UPDATE order_items SET quantity = $1, subtotal = $2 WHERE id = $3`,
                    [newQty, newSubtotal, existing[0].id]
                );
            } else {
                await client.query(
                    `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, subtotal)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [id, item.product_id, item.product.name, item.quantity, item.product.price, item.lineSubtotal]
                );
            }
            await client.query(
                `UPDATE products SET stock = stock - $1 WHERE id = $2`,
                [item.quantity, item.product_id]
            );
        }

        const newTotal = Number(order.total) + extraSubtotal;
        await client.query(
            `UPDATE orders SET subtotal = $1, total = $1 WHERE id = $2`,
            [newTotal, id]
        );

        await client.query('COMMIT');

        const { rows: updatedOrder } = await db.query(
            `SELECT o.*, t.label AS table_label FROM orders o
             JOIN tables t ON t.id = o.table_id WHERE o.id = $1`, [id]
        );
        const { rows: finalItems } = await db.query(
            `SELECT * FROM order_items WHERE order_id = $1 ORDER BY id`, [id]
        );
        updatedOrder[0].items = finalItems;

        res.json({ success: true, data: updatedOrder[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
};

// POST /api/orders/:id/pay — convertir pedido en venta y liberar mesa
exports.pay = async (req, res, next) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const { id } = req.params;
        const { payment_method = 'efectivo', amount_received, customer_name, notes } = req.body;
        const user_id = req.user.id;

        const { rows: orderRows } = await client.query(
            `SELECT o.*, t.label AS table_label FROM orders o
             JOIN tables t ON t.id = o.table_id
             WHERE o.id = $1 AND o.status = 'pendiente'`,
            [id]
        );
        if (!orderRows.length) throw Object.assign(new Error('Pedido no encontrado o ya procesado.'), { status: 404 });
        const order = orderRows[0];

        const { rows: items } = await client.query(
            `SELECT * FROM order_items WHERE order_id = $1`, [id]
        );

        // Generar número de venta con MAX secuencial (mismo patrón que orders)
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const salePrefix = `VTA-${today}-`;
        const { rows: cntRows } = await client.query(
            `SELECT COALESCE(MAX(CAST(RIGHT(sale_number, 4) AS INTEGER)), 0) AS max_seq
             FROM sales WHERE sale_number LIKE $1`,
            [`${salePrefix}%`]
        );
        const seq = String(parseInt(cntRows[0].max_seq, 10) + 1).padStart(4, '0');
        const sale_number = `${salePrefix}${seq}`;

        const change_given = payment_method === 'efectivo' && amount_received
            ? Math.max(0, Number(amount_received) - Number(order.total))
            : null;

        const { rows: saleRows } = await client.query(
            `INSERT INTO sales
             (sale_number, user_id, customer_name, subtotal, total, payment_method,
              amount_received, change_given, status, notes, order_id)
             VALUES ($1,$2,$3,$4,$4,$5,$6,$7,'completada',$8,$9) RETURNING *`,
            [
                sale_number, user_id,
                customer_name || order.table_label,
                order.total, payment_method,
                amount_received || null, change_given,
                notes || order.notes,
                order.id,
            ]
        );
        const sale = saleRows[0];

        for (const item of items) {
            await client.query(
                `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal)
                 VALUES ($1,$2,$3,$4,$5,$6)`,
                [sale.id, item.product_id, item.product_name, item.quantity, item.unit_price, item.subtotal]
            );
        }

        await client.query(`UPDATE orders SET status = 'pagado' WHERE id = $1`, [id]);
        await client.query(`UPDATE tables SET is_occupied = FALSE WHERE id = $1`, [order.table_id]);
        await client.query('COMMIT');

        sale.items = items;
        sale.sale_number = sale_number;
        sale.change_given = change_given;

        res.json({ success: true, data: sale });
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
};

// POST /api/orders/:id/cancel — cancelar pedido y liberar mesa + reponer stock
exports.cancel = async (req, res, next) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const { id } = req.params;
        const { rows: orderRows } = await client.query(
            `SELECT * FROM orders WHERE id = $1 AND status = 'pendiente'`, [id]
        );
        if (!orderRows.length) throw Object.assign(new Error('Pedido no encontrado o ya procesado.'), { status: 404 });
        const order = orderRows[0];

        const { rows: items } = await client.query(
            `SELECT * FROM order_items WHERE order_id = $1`, [id]
        );

        for (const item of items) {
            await client.query(
                `UPDATE products SET stock = stock + $1 WHERE id = $2`,
                [item.quantity, item.product_id]
            );
        }

        await client.query(`UPDATE orders SET status = 'cancelado' WHERE id = $1`, [id]);
        await client.query(`UPDATE tables SET is_occupied = FALSE WHERE id = $1`, [order.table_id]);
        await client.query('COMMIT');

        res.json({ success: true, message: 'Pedido cancelado y mesa liberada.' });
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
};