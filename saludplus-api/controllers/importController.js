const fs = require('fs');
const csv = require('csv-parser');
const pool = require('../config/db.mysql');
const PatientHistory = require('../models/PatientHistory');

const importData = async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Please upload a CSV file' });

    const results = [];

    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            const connection = await pool.getConnection();
            try {
                // Remove duplicates and prepare insertions using Sets/Maps
                const patientsMap = new Map();
                const doctorsMap = new Map();
                const insurancesMap = new Map();
                const treatmentsMap = new Map();

                // --- MONGODB PREPARATION ---
                const mongoHistories = new Map(); // patientEmail -> { document }

                // First pass: extract unique entities
                // AQUI ADAPTAS LOS MAPAS DEPENDIENDO DE QUÉ TABLAS TIENE TU NUEVA BASE DE DATOS
                // Y DE QUÉ COLUMNAS TIENE TU NUEVO ARCHIVO CSV.
                // EJEMPLO: miNuevaTablaMap.set(row.columna_csv, { campo1: row.columna1, campo2: row.columna2 })
                for (const row of results) {
                    patientsMap.set(row.patient_email, {
                        name: row.patient_name,
                        email: row.patient_email,
                        phone: row.patient_phone,
                        address: row.patient_address
                    });

                    doctorsMap.set(row.doctor_email, {
                        name: row.doctor_name,
                        email: row.doctor_email,
                        specialty: row.specialty
                    });

                    if (row.insurance_provider && row.insurance_provider !== 'SinSeguro') {
                        insurancesMap.set(row.insurance_provider, {
                            name: row.insurance_provider,
                            coverage: row.coverage_percentage
                        });
                    }

                    treatmentsMap.set(row.treatment_code, {
                        code: row.treatment_code,
                        description: row.treatment_description,
                        cost: row.treatment_cost
                    });

                    // Build MongoDB structure in memory (Idempotent per file run)
                    if (!mongoHistories.has(row.patient_email)) {
                        mongoHistories.set(row.patient_email, {
                            patientEmail: row.patient_email,
                            patientName: row.patient_name,
                            appointments: []
                        });
                    }

                    mongoHistories.get(row.patient_email).appointments.push({
                        appointmentId: row.appointment_id,
                        date: new Date(row.appointment_date),
                        doctorName: row.doctor_name,
                        specialty: row.specialty,
                        treatmentDescription: row.treatment_description,
                        amountPaid: Number(row.amount_paid) || 0
                    });
                }

                // === MYSQL TRANSACTIONS ===
                await connection.beginTransaction();

                // AQUI CAMBIAS LOS INSERTS POR TUS PREPARADOS PARA TU NUEVA BASE DE DATOS (SI USAS MYSQL)
                // EJEMPLO: 
                // for (const item of miNuevaTablaMap.values()) {
                //      await connection.query('INSERT INTO mi_nueva_tabla (campo1) VALUES (?)', [item.campo1]);
                // }

                for (const patient of patientsMap.values()) {
                    await connection.query(
                        `INSERT INTO patients (name, email, phone, address) 
                         VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=name`,
                        [patient.name, patient.email, patient.phone, patient.address]
                    );
                }

                for (const doctor of doctorsMap.values()) {
                    await connection.query(
                        `INSERT INTO doctors (name, email, specialty) 
                         VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name=name`,
                        [doctor.name, doctor.email, doctor.specialty]
                    );
                }

                for (const ins of insurancesMap.values()) {
                    await connection.query(
                        `INSERT INTO insurances (name, coverage_percentage) 
                         VALUES (?, ?) ON DUPLICATE KEY UPDATE name=name`,
                        [ins.name, ins.coverage]
                    );
                }

                for (const treatment of treatmentsMap.values()) {
                    await connection.query(
                        `INSERT INTO treatments (treatment_code, description, cost) 
                         VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE description=description`,
                        [treatment.code, treatment.description, treatment.cost]
                    );
                }

                const [dbPatients] = await connection.query('SELECT id, email FROM patients');
                const pLookup = Object.fromEntries(dbPatients.map(p => [p.email, p.id]));

                const [dbDoctors] = await connection.query('SELECT id, email FROM doctors');
                const dLookup = Object.fromEntries(dbDoctors.map(d => [d.email, d.id]));

                const [dbInsurances] = await connection.query('SELECT id, name FROM insurances');
                const iLookup = Object.fromEntries(dbInsurances.map(i => [i.name, i.id]));

                const [dbTreatments] = await connection.query('SELECT id, treatment_code FROM treatments');
                const tLookup = Object.fromEntries(dbTreatments.map(t => [t.treatment_code, t.id]));

                for (const row of results) {
                    const patientId = pLookup[row.patient_email];
                    const doctorId = dLookup[row.doctor_email];
                    const insuranceId = row.insurance_provider && row.insurance_provider !== 'SinSeguro' ? iLookup[row.insurance_provider] : null;
                    const treatmentId = tLookup[row.treatment_code];

                    await connection.query(
                        `INSERT INTO appointments (appointment_id, appointment_date, patient_id, doctor_id, insurance_id, treatment_id, amount_paid) 
                         VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE appointment_date=appointment_date`,
                        [row.appointment_id, row.appointment_date, patientId, doctorId, insuranceId, treatmentId, row.amount_paid || 0]
                    );
                }

                await connection.commit(); // Save MySQL changes

                await connection.commit(); // Save MySQL changes

                // === MONGODB UPSERT (Idempotency) ===
                // AQUI CAMBIAS COMO GUARDAS EN MONGO SI USAS MONGODB Y TIENES UNA COLECCION DISTINTA
                for (const history of mongoHistories.values()) {
                    await PatientHistory.findOneAndUpdate(
                        { patientEmail: history.patientEmail },
                        {
                            $set: { patientName: history.patientName },
                            $addToSet: {
                                // addToSet ensures the exact same object isn't duplicated. 
                                // Since we want idempotency based on appointmentId, we do a workaround:
                                // Update existing or push new ones dynamically
                            }
                        },
                        { upsert: true, new: true }
                    );

                    // Note: addToSet checks exact object match. To be safer and truly idempotent by appointmentId:
                    const existingDoc = await PatientHistory.findOne({ patientEmail: history.patientEmail });
                    const existingApptIds = new Set(existingDoc.appointments.map(a => a.appointmentId));

                    const newAppts = history.appointments.filter(a => !existingApptIds.has(a.appointmentId));
                    if (newAppts.length > 0) {
                        await PatientHistory.updateOne(
                            { patientEmail: history.patientEmail },
                            { $push: { appointments: { $each: newAppts } } }
                        );
                    }
                }

                // Cleanup uploaded file
                if (req.file && req.file.path) {
                    fs.unlinkSync(req.file.path);
                }

                res.status(200).json({ message: 'Data imported and normalized successfully in both MySQL and MongoDB' });

            } catch (error) {
                await connection.rollback();
                console.error("Import error:", error);
                res.status(500).json({ error: 'Import failed', details: error.message });
            } finally {
                connection.release();
            }
        });
};

module.exports = { importData };
