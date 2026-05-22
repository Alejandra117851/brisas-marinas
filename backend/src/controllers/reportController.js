/**
 * Controlador del módulo de Reportes.
 * Endpoints:
 *   GET /api/reports/summary        - Resumen general (hoy, semana, mes)
 *   GET /api/reports/sales-by-day   - Ventas por día (rango)
 *   GET /api/reports/top-products   - Productos más vendidos
 *   GET /api/reports/by-payment     - Ventas por método de pago
 *   GET /api/reports/by-category    - Ventas por categoría
 *   GET /api/reports/by-user        - Ventas por cajero/empleado
 */
const db = require('../config/database');

/**
 * GET /api/reports/summary
 * Devuelve KPIs: ventas hoy, semana actual, mes actual, total productos, bajo stock.
 */
async function summary(req, res, next) {
    try {
        const queries = await Promise.all([
            db.query(`
                SELECT COALESCE(SUM(total), 0) AS total,
                       COUNT(*) AS count
                  FROM sales
                 WHERE status = 'completada'
                   AND DATE(created_at) = CURRENT_DATE
            `),
            db.query(`
                SELECT COALESCE(SUM(total), 0) AS total,
                       COUNT(*) AS count
                  FROM sales
                 WHERE status = 'completada'
                   AND created_at >= date_trunc('week', CURRENT_DATE)
            `),
            db.query(`
                SELECT COALESCE(SUM(total), 0) AS total,
                       COUNT(*) AS count
                  FROM sales
                 WHERE status = 'completada'
                   AND created_at >= date_trunc('month', CURRENT_DATE)
            `),
            db.query(`SELECT COUNT(*) AS total FROM products WHERE is_active = TRUE`),
            db.query(`SELECT COUNT(*) AS total FROM v_low_stock_products`),
            db.query(`
                SELECT COALESCE(AVG(total), 0) AS average_ticket
                  FROM sales
                 WHERE status = 'completada'
                   AND created_at >= date_trunc('month', CURRENT_DATE)
            `),
        ]);

        res.json({
            success: true,
            data: {
                today:           { sales: parseInt(queries[0].rows[0].count), revenue: Number(queries[0].rows[0].total) },
                week:            { sales: parseInt(queries[1].rows[0].count), revenue: Number(queries[1].rows[0].total) },
                month:           { sales: parseInt(queries[2].rows[0].count), revenue: Number(queries[2].rows[0].total) },
                active_products: parseInt(queries[3].rows[0].total),
                low_stock_count: parseInt(queries[4].rows[0].total),
                average_ticket:  Number(queries[5].rows[0].average_ticket),
            }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/reports/sales-by-day?from=...&to=...
 */
async function salesByDay(req, res, next) {
    try {
        const { from, to } = req.query;
        const fromDate = from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        const toDate   = to   || new Date().toISOString().slice(0, 10);

        const result = await db.query(
            `SELECT DATE(created_at) AS date,
                    COUNT(*)         AS sales_count,
                    COALESCE(SUM(total), 0) AS total_revenue
               FROM sales
              WHERE status = 'completada'
                AND created_at >= $1::date
                AND created_at <  $2::date + 1
              GROUP BY DATE(created_at)
              ORDER BY date ASC`,
            [fromDate, toDate]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/reports/top-products?from=&to=&limit=10
 */
async function topProducts(req, res, next) {
    try {
        const { from, to, limit = 10 } = req.query;
        const conditions = [`s.status = 'completada'`];
        const params = [];
        let idx = 1;

        if (from) { conditions.push(`s.created_at >= $${idx++}`);           params.push(from); }
        if (to)   { conditions.push(`s.created_at <  $${idx++}::date + 1`); params.push(to);   }

        const result = await db.query(
            `SELECT si.product_id,
                    si.product_name,
                    SUM(si.quantity)          AS total_quantity,
                    SUM(si.subtotal)          AS total_revenue,
                    COUNT(DISTINCT si.sale_id) AS times_sold
               FROM sale_items si
               JOIN sales s ON s.id = si.sale_id
              WHERE ${conditions.join(' AND ')}
              GROUP BY si.product_id, si.product_name
              ORDER BY total_quantity DESC
              LIMIT $${idx}`,
            [...params, limit]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/reports/by-payment?from=&to=
 */
async function byPaymentMethod(req, res, next) {
    try {
        const { from, to } = req.query;
        const conditions = [`status = 'completada'`];
        const params = [];
        let idx = 1;

        if (from) { conditions.push(`created_at >= $${idx++}`);           params.push(from); }
        if (to)   { conditions.push(`created_at <  $${idx++}::date + 1`); params.push(to);   }

        const result = await db.query(
            `SELECT payment_method,
                    COUNT(*) AS sales_count,
                    COALESCE(SUM(total), 0) AS total_revenue
               FROM sales
              WHERE ${conditions.join(' AND ')}
              GROUP BY payment_method
              ORDER BY total_revenue DESC`,
            params
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/reports/by-category?from=&to=
 */
async function byCategory(req, res, next) {
    try {
        const { from, to } = req.query;
        const conditions = [`s.status = 'completada'`];
        const params = [];
        let idx = 1;

        if (from) { conditions.push(`s.created_at >= $${idx++}`);           params.push(from); }
        if (to)   { conditions.push(`s.created_at <  $${idx++}::date + 1`); params.push(to);   }

        const result = await db.query(
            `SELECT COALESCE(c.name, 'Sin categoría') AS category_name,
                    SUM(si.quantity) AS total_quantity,
                    SUM(si.subtotal) AS total_revenue
               FROM sale_items si
               JOIN sales    s ON s.id = si.sale_id
               JOIN products p ON p.id = si.product_id
               LEFT JOIN categories c ON c.id = p.category_id
              WHERE ${conditions.join(' AND ')}
              GROUP BY c.name
              ORDER BY total_revenue DESC`,
            params
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/reports/by-user?from=&to=
 */
async function byUser(req, res, next) {
    try {
        const { from, to } = req.query;
        const conditions = [`s.status = 'completada'`];
        const params = [];
        let idx = 1;

        if (from) { conditions.push(`s.created_at >= $${idx++}`);           params.push(from); }
        if (to)   { conditions.push(`s.created_at <  $${idx++}::date + 1`); params.push(to);   }

        const result = await db.query(
            `SELECT u.id AS user_id,
                    u.full_name,
                    u.role,
                    COUNT(s.id) AS sales_count,
                    COALESCE(SUM(s.total), 0) AS total_revenue
               FROM sales s
               JOIN users u ON u.id = s.user_id
              WHERE ${conditions.join(' AND ')}
              GROUP BY u.id, u.full_name, u.role
              ORDER BY total_revenue DESC`,
            params
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    summary, salesByDay, topProducts,
    byPaymentMethod, byCategory, byUser
};
