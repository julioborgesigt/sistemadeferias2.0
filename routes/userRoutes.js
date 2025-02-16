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
router.post('/update-limits', ensureAuthenticated, userController.updateLimits);
// Nova rota para resetar férias
router.post('/reset-vacations', ensureAuthenticated, userController.resetVacations);
// Nova rota para apagar matrícula
router.post('/delete-user', ensureAuthenticated, userController.deleteUser);
router.get('/classification', ensureAuthenticated, userController.showClassification);


module.exports = router;
