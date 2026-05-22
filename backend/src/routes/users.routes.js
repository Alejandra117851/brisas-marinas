const router = require('express').Router();
const { body, param } = require('express-validator');
const ctrl = require('../controllers/userController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

// Todas las rutas requieren autenticación y rol administrador.
router.use(authenticate, authorize('administrador'));

router.get('/', ctrl.list);

router.get('/:id',
    [param('id').isInt().withMessage('ID inválido.'), validate],
    ctrl.getById
);

router.post('/',
    [
        body('username').trim().isLength({ min: 3, max: 50 }).withMessage('Usuario entre 3 y 50 caracteres.'),
        body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres.'),
        body('full_name').trim().notEmpty().withMessage('El nombre completo es obligatorio.'),
        body('email').optional({ checkFalsy: true }).isEmail().withMessage('Correo inválido.'),
        body('role').isIn(['administrador', 'cajero', 'empleado']).withMessage('Rol inválido.'),
        validate,
    ],
    ctrl.create
);

router.put('/:id',
    [
        param('id').isInt().withMessage('ID inválido.'),
        body('username').optional().trim().isLength({ min: 3, max: 50 }),
        body('full_name').optional().trim().notEmpty(),
        body('email').optional({ checkFalsy: true }).isEmail(),
        body('role').optional().isIn(['administrador', 'cajero', 'empleado']),
        body('is_active').optional().isBoolean(),
        validate,
    ],
    ctrl.update
);

router.put('/:id/reset-password',
    [
        param('id').isInt(),
        body('new_password').isLength({ min: 6 }).withMessage('Mínimo 6 caracteres.'),
        validate,
    ],
    ctrl.resetPassword
);

router.delete('/:id',
    [param('id').isInt(), validate],
    ctrl.remove
);

module.exports = router;
