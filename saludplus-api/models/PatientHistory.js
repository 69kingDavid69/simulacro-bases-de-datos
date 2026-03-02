const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    appointmentId: { type: String, required: true },
    date: { type: Date, required: true },
    doctorName: { type: String, required: true },
    specialty: { type: String, required: true },
    treatmentDescription: { type: String, required: true },
    amountPaid: { type: Number, required: true }
}, { _id: false });

const patientHistorySchema = new mongoose.Schema({
    patientEmail: { type: String, required: true, unique: true },
    patientName: { type: String, required: true },
    appointments: [appointmentSchema]
});

module.exports = mongoose.model('PatientHistory', patientHistorySchema);
