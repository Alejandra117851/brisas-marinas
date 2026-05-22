const router = require('express').Router();
const { body, param } = require('express-validator');
const ctrl = require('../controllers/productController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

// Todas las rutas requieren autenticación.
router.use(authenticate);

// --- Lectura: todos los roles autenticados ---
router.get('/', ctrl.list);
router.get('/low-stock', ctrl.getLowStock);
router.get('/:id',
    [param('id').isInt(), validate],
    ctrl.getById
);

// --- Escritura: solo administrador ---
router.post('/',
    authorize('administrador'),
    [
        body('name').trim().notEmpty().withMessage('El nombre es obligatorio.'),
        body('price').isFloat({ min: 0 }).withMessage('Precio inválido.'),
        body('cost').optional().isFloat({ min: 0 }),
        body('stock').optional().isInt({ min: 0 }),
        body('min_stock').optional().isInt({ min: 0 }),
        body('category_id').optional({ checkFalsy: true }).isInt(),
        validate,
    ],
    ctrl.create
);

router.put('/:id',
    authorize('administrador'),
    [
        param('id').isInt(),
        body('price').optional().isFloat({ min: 0 }),
        body('cost').optional().isFloat({ min: 0 }),
        body('min_stock').optional().isInt({ min: 0 }),
        body('is_active').optional().isBoolean(),
        validate,
    ],
    ctrl.update
);

router.patch('/:id/stock',
    authorize('administrador'),
    [
        param('id').isInt(),
        body('adjustment').isInt().withMessage('El ajuste debe ser un entero.'),
        validate,
    ],
    ctrl.adjustStock
);

router.delete('/:id',
    authorize('administrador'),
    [param('id').isInt(), validate],
    ctrl.remove
);

module.exports = router;
