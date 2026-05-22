/**
 * orders.routes.js
 */
const router = require('express').Router();
const { body, param } = require('express-validator');
const ctrl = require('../controllers/orderController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

router.use(authenticate);

router.get('/', authorize('administrador', 'cajero', 'empleado'), ctrl.list);

router.get('/:id', authorize('administrador', 'cajero', 'empleado'),
    [param('id').isInt(), validate], ctrl.getById);

router.post('/',
    authorize('administrador', 'cajero', 'empleado'),
    [
        body('table_id').isInt({ min: 1 }).withMessage('Mesa inválida.'),
        body('items').isArray({ min: 1 }).withMessage('El pedido debe tener al menos un producto.'),
        body('items.*.product_id').isInt(),
        body('items.*.quantity').isInt({ min: 1 }),
        validate,
    ],
    ctrl.create
);

// ── NUEVO: agregar productos a un pedido pendiente ──────────────
router.post('/:id/add-items',
    authorize('administrador', 'cajero', 'empleado'),
    [
        param('id').isInt(),
        body('items').isArray({ min: 1 }).withMessage('Debe enviar al menos un producto.'),
        body('items.*.product_id').isInt(),
        body('items.*.quantity').isInt({ min: 1 }),
        validate,
    ],
    ctrl.addItems
);

router.post('/:id/pay',
    authorize('administrador', 'cajero', 'empleado'),
    [
        param('id').isInt(),
        body('payment_method').optional().isIn(['efectivo', 'transferencia', 'tarjeta', 'nequi', 'daviplata']),
        body('amount_received').optional({ checkFalsy: true }).isFloat({ min: 0 }),
        validate,
    ],
    ctrl.pay
);

router.post('/:id/cancel',
    authorize('administrador', 'cajero', 'empleado'),
    [param('id').isInt(), validate],
    ctrl.cancel
);

module.exports = router;