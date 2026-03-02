const express = require('express');
const router = express.Router();
const multer = require('multer');
const { importData } = require('../controllers/importController');
const { getDoctors, getDoctorById, createDoctor, updateDoctor, deleteDoctor, getRevenueReport, getPatientHistory } = require('../controllers/apiController');

const upload = multer({ dest: 'uploads/' });


router.post('/import', upload.single('file'), importData);


router.get('/doctors', getDoctors);
router.get('/doctors/:id', getDoctorById);
router.post('/doctors', createDoctor);
router.put('/doctors/:id', updateDoctor);
router.delete('/doctors/:id', deleteDoctor);


router.get('/reports/revenue', getRevenueReport);


router.get('/patients/:email/history', getPatientHistory);

module.exports = router;
