const router = require('express').Router();
const { body } = require('express-validator');
const { login, me, changePassword } = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

router.post(
    '/login',
    [
        body('username').trim().notEmpty().withMessage('El usuario es obligatorio.'),
        body('password').notEmpty().withMessage('La contraseña es obligatoria.'),
        validate,
    ],
    login
);

router.get('/me', authenticate, me);

router.post(
    '/change-password',
    authenticate,
    [
        body('current_password').notEmpty().withMessage('La contraseña actual es obligatoria.'),
        body('new_password').isLength({ min: 6 }).withMessage('La nueva contraseña debe tener al menos 6 caracteres.'),
        validate,
    ],
    changePassword
);

module.exports = router;
