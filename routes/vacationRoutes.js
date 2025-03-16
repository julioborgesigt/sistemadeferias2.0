// routes/vacationRoutes.js
const express = require('express');
const router = express.Router();
const vacationController = require('../controllers/vacationController');

router.get('/form', vacationController.showVacationForm);
router.post('/mark', vacationController.markVacation);
router.get('/calendar', vacationController.showCalendar);
router.get('/confirmation', vacationController.confirmVacation);
router.get('/year-calendar', vacationController.showYearCalendar);
router.get('/calendar-options', vacationController.showCalendarOptions);
// nova rota para exibir o formulário de férias para admin
router.get('/admin-form', vacationController.showAdminVacationForm);
// nova rota para processar o cadastro de férias pelo admin
router.post('/admin-mark', vacationController.adminMarkVacation);



module.exports = router;
