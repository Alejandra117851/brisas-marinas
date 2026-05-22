const router = require('express').Router();
const { body, param } = require('express-validator');
const ctrl = require('../controllers/saleController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

router.use(authenticate);

// Listar ventas: administrador y cajero
router.get('/',
    authorize('administrador', 'cajero'),
    ctrl.list
);

router.get('/:id',
    authorize('administrador', 'cajero'),
    [param('id').isInt(), validate],
    ctrl.getById
);

// Crear venta: administrador, cajero, empleado
router.post('/',
    authorize('administrador', 'cajero', 'empleado'),
    [
        body('items').isArray({ min: 1 }).withMessage('La venta debe contener al menos un producto.'),
        body('items.*.product_id').isInt().withMessage('ID de producto inválido.'),
        body('items.*.quantity').isInt({ min: 1 }).withMessage('La cantidad debe ser un entero positivo.'),
        body('payment_method').optional().isIn(['efectivo', 'transferencia', 'tarjeta', 'nequi', 'daviplata']),
        body('discount').optional().isFloat({ min: 0 }),
        body('amount_received').optional({ checkFalsy: true }).isFloat({ min: 0 }),
        validate,
    ],
    ctrl.create
);

// Anular venta: solo administrador
router.post('/:id/void',
    authorize('administrador'),
    [param('id').isInt(), validate],
    ctrl.voidSale
);

module.exports = router;
