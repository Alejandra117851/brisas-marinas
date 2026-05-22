const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/productController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

router.use(authenticate);

router.get('/', ctrl.getCategories);

router.post('/',
    authorize('administrador'),
    [
        body('name').trim().notEmpty().withMessage('El nombre es obligatorio.'),
        validate,
    ],
    ctrl.createCategory
);

module.exports = router;
