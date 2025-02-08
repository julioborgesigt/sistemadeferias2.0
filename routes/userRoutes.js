// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Middleware para proteger as rotas de administrador
function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.admin) {
    return next();
  }
  req.flash('error_msg', 'Por favor, faça login.');
  res.redirect('/auth/login');
}

router.get('/dashboard', ensureAuthenticated, userController.dashboard);
router.get('/register', ensureAuthenticated, userController.showRegistrationForm);
router.post('/register', ensureAuthenticated, userController.registerUser);

module.exports = router;
