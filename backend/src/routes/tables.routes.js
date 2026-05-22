const router = require('express').Router();
const { param } = require('express-validator');
const ctrl = require('../controllers/tableController');
const { authenticate } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
 
router.use(authenticate);
 
router.get('/', ctrl.list);
router.patch('/:id/occupy', [param('id').isInt(), validate], ctrl.occupy);
router.patch('/:id/free',   [param('id').isInt(), validate], ctrl.free);
 
module.exports = router;