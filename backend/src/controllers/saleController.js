/**
 * Controlador del módulo de Ventas.
 * - create: crea la venta con sus items dentro de una transacción
 *           y descuenta automáticamente el stock de cada producto.
 * - list, getById, void
 */
const db = require('../config/database');

/**
 * Genera el número consecutivo de venta basado en el último ID + 1.
 * Formato: VTA-YYYYMMDD-NNNN
 *
 * Usa pg_advisory_xact_lock con la fecha como clave para serializar la
 * generación dentro del día y evitar colisiones bajo concurrencia.
 * El lock se libera automáticamente al COMMIT/ROLLBACK de la transacción.
 */
async function generateSaleNumber(client) {
    const today = new Date();
    const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, '');

    await client.query('SELECT pg_advisory_xact_lock($1)', [parseInt(yyyymmdd, 10)]);

    const result = await client.query(
        `SELECT COUNT(*) AS count
           FROM sales
          WHERE DATE(created_at) = CURRENT_DATE`
    );
    const seq = (parseInt(result.rows[0].count, 10) + 1).toString().padStart(4, '0');
    return `VTA-${yyyymmdd}-${seq}`;
}

/**
 * POST /api/sales
 * Body: {
 *   items: [{ product_id, quantity }],
 *   payment_method, customer_name, discount, amount_received, notes
 * }
 */
async function create(req, res, next) {
    try {
        const {
            items,
            payment_method = 'efectivo',
            customer_name = null,
            discount = 0,
            amount_received = null,
            notes = null
        } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'La venta debe contener al menos un producto.'
            });
        }

        const sale = await db.withTransaction(async (client) => {
            // 1) Validar productos y calcular totales
            const productIds = items.map(i => i.product_id);
            const productsResult = await client.query(
                `SELECT id, name, price, stock, is_active
                   FROM products
                  WHERE id = ANY($1::int[])
                    FOR UPDATE`,
                [productIds]
            );
            const productMap = new Map(productsResult.rows.map(p => [p.id, p]));

            let subtotal = 0;
            const detailedItems = items.map(it => {
                const p = productMap.get(it.product_id);
                if (!p) throw Object.assign(new Error(`Producto ${it.product_id} no existe.`), { status: 400 });
                if (!p.is_active) throw Object.assign(new Error(`El producto "${p.name}" está inactivo.`), { status: 400 });
                if (it.quantity <= 0) throw Object.assign(new Error(`Cantidad inválida para "${p.name}".`), { status: 400 });
                if (p.stock < it.quantity) {
                    throw Object.assign(
                        new Error(`Stock insuficiente para "${p.name}". Disponible: ${p.stock}, solicitado: ${it.quantity}.`),
                        { status: 400 }
                    );
                }
                const lineSubtotal = Number(p.price) * it.quantity;
                subtotal += lineSubtotal;
                return {
                    product_id:   p.id,
                    product_name: p.name,
                    quantity:     it.quantity,
                    unit_price:   Number(p.price),
                    subtotal:     lineSubtotal,
                };
            });

            const total = Math.max(0, subtotal - Number(discount || 0));
            const change_given = amount_received != null
                ? Math.max(0, Number(amount_received) - total)
                : null;

            // 2) Generar número de venta y crear encabezado
            const saleNumber = await generateSaleNumber(client);
            const headerResult = await client.query(
                `INSERT INTO sales
                    (sale_number, user_id, customer_name, subtotal, discount, total,
                     payment_method, amount_received, change_given, notes)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 RETURNING *`,
                [
                    saleNumber,
                    req.user.id,
                    customer_name,
                    subtotal,
                    discount,
                    total,
                    payment_method,
                    amount_received,
                    change_given,
                    notes
                ]
            );
            const saleHeader = headerResult.rows[0];

            // 3) Insertar items + descontar stock
            for (const it of detailedItems) {
                await client.query(
                    `INSERT INTO sale_items
                        (sale_id, product_id, product_name, quantity, unit_price, subtotal)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [saleHeader.id, it.product_id, it.product_name, it.quantity, it.unit_price, it.subtotal]
                );
                await client.query(
                    `UPDATE products SET stock = stock - $1 WHERE id = $2`,
                    [it.quantity, it.product_id]
                );
            }

            return { ...saleHeader, items: detailedItems };
        });

        res.status(201).json({
            success: true,
            message: 'Venta registrada correctamente.',
            data: sale
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/sales
 * Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD&status=&user_id=&payment_method=&limit=
 */
async function list(req, res, next) {
    try {
        const { from, to, status, user_id, payment_method, limit = 100 } = req.query;
        const conditions = [];
        const params = [];
        let idx = 1;

        if (from)            { conditions.push(`s.created_at >= $${idx++}`);             params.push(from); }
        if (to)              { conditions.push(`s.created_at <  $${idx++}::date + 1`);   params.push(to); }
        if (status)          { conditions.push(`s.status = $${idx++}`);                  params.push(status); }
        if (user_id)         { conditions.push(`s.user_id = $${idx++}`);                 params.push(user_id); }
        if (payment_method)  { conditions.push(`s.payment_method = $${idx++}`);          params.push(payment_method); }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const result = await db.query(
            `SELECT s.id, s.sale_number, s.user_id, u.full_name AS user_name,
                    s.customer_name, s.subtotal, s.discount, s.total,
                    s.payment_method, s.status, s.created_at
               FROM sales s
               JOIN users u ON u.id = s.user_id
               ${where}
              ORDER BY s.created_at DESC
              LIMIT $${idx}`,
            [...params, limit]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/sales/:id
 */
async function getById(req, res, next) {
    try {
        const { id } = req.params;
        const saleResult = await db.query(
            `SELECT s.*, u.full_name AS user_name
               FROM sales s
               JOIN users u ON u.id = s.user_id
              WHERE s.id = $1`,
            [id]
        );
        if (saleResult.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Venta no encontrada.' });
        }
        const itemsResult = await db.query(
            'SELECT * FROM sale_items WHERE sale_id = $1 ORDER BY id',
            [id]
        );
        res.json({
            success: true,
            data: { ...saleResult.rows[0], items: itemsResult.rows }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/sales/:id/void
 * Anula una venta y restaura el stock. Solo administrador.
 */
async function voidSale(req, res, next) {
    try {
        const { id } = req.params;
        const result = await db.withTransaction(async (client) => {
            const saleResult = await client.query(
                `SELECT * FROM sales WHERE id = $1 FOR UPDATE`,
                [id]
            );
            if (saleResult.rowCount === 0) {
                throw Object.assign(new Error('Venta no encontrada.'), { status: 404 });
            }
            const sale = saleResult.rows[0];
            if (sale.status === 'anulada') {
                throw Object.assign(new Error('La venta ya está anulada.'), { status: 400 });
            }

            const itemsResult = await client.query(
                'SELECT product_id, quantity FROM sale_items WHERE sale_id = $1',
                [id]
            );

            // Restaurar stock de los productos
            for (const item of itemsResult.rows) {
                await client.query(
                    'UPDATE products SET stock = stock + $1 WHERE id = $2',
                    [item.quantity, item.product_id]
                );
            }

            await client.query(
                `UPDATE sales
                    SET status = 'anulada', voided_at = CURRENT_TIMESTAMP, voided_by = $1
                  WHERE id = $2`,
                [req.user.id, id]
            );

            return { id: sale.id, sale_number: sale.sale_number };
        });

        res.json({
            success: true,
            message: 'Venta anulada correctamente. El stock ha sido restaurado.',
            data: result
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { create, list, getById, voidSale };
