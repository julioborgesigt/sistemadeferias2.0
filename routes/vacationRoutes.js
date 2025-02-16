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


module.exports = router;
