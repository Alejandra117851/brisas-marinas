const router = require('express').Router();
const ctrl = require('../controllers/reportController');
const { authenticate, authorize } = require('../middlewares/auth');

// Solo administrador puede acceder a los reportes (acorde al documento)
router.use(authenticate, authorize('administrador'));

router.get('/summary',       ctrl.summary);
router.get('/sales-by-day',  ctrl.salesByDay);
router.get('/top-products',  ctrl.topProducts);
router.get('/by-payment',    ctrl.byPaymentMethod);
router.get('/by-category',   ctrl.byCategory);
router.get('/by-user',       ctrl.byUser);

module.exports = router;
