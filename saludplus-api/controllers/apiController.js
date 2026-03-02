const pool = require('../config/db.mysql');
const PatientHistory = require('../models/PatientHistory');

const getDoctors = async (req, res) => {
    try {
        const { specialty } = req.query;
        let query = 'SELECT * FROM doctors';
        let params = [];

        if (specialty) {
            query += ' WHERE specialty = ?';
            params.push(specialty);
        }

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createDoctor = async (req, res) => {
    // AQUI VA TU INSERCION PARA OTRA TABLA SI USAS OTRA BASE DE DATOS/OTRO CSV
    // EJEMPLO: const [result] = await pool.query('INSERT INTO otra_tabla (campo1) VALUES (?)', [campo1]);
    const { name, email, specialty } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO doctors (name, email, specialty) VALUES (?, ?, ?)',
            [name, email, specialty]
        );
        res.status(201).json({ id: result.insertId, name, email, specialty });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getDoctorById = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM doctors WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Doctor not found' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateDoctor = async (req, res) => {
    const { id } = req.params;
    const { name, email, specialty } = req.body;

    try {
        // 1. Get old doctor name before update to find them in MongoDB
        const [rows] = await pool.query('SELECT name FROM doctors WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Doctor not found' });
        const oldName = rows[0].name;

        // 2. Update in MySQL
        await pool.query(
            'UPDATE doctors SET name = ?, email = ?, specialty = ? WHERE id = ?',
            [name, email, specialty, id]
        );

        // 3. Update related documents in MongoDB
        if (name && oldName !== name) {
            // MongoDB matches by doc name in the appointments array
            await PatientHistory.updateMany(
                { 'appointments.doctorName': oldName },
                { $set: { 'appointments.$[elem].doctorName': name } },
                { arrayFilters: [{ 'elem.doctorName': oldName }] } // Update only the matching objects in array
            );
        }

        res.json({ message: 'Doctor updated successfully in MySQL and Mongoose synced' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteDoctor = async (req, res) => {
    const { id } = req.params;
    try {
        // AQUI VA TU QUERY DE ELIMINACION PARA OTRA TABLA
        // EJEMPLO: await pool.query('DELETE FROM otra_tabla WHERE id = ?', [id]);
        const [result] = await pool.query('DELETE FROM doctors WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Doctor not found' });
        res.json({ message: 'Doctor deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


const getRevenueReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Base filter if dates provided
        let dateFilter = '';
        let params = [];
        if (startDate && endDate) {
            dateFilter = 'WHERE a.appointment_date BETWEEN ? AND ?';
            params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
        }

        // 1. Total Revenue
        const [totalRes] = await pool.query(`SELECT SUM(amount_paid) as totalRevenue FROM appointments a ${dateFilter}`, params);

        // 2. Total By Insurance Provider
        const [insuranceRes] = await pool.query(`
            SELECT IFNULL(i.name, 'SinSeguro') AS insurance, SUM(a.amount_paid) AS total
            FROM appointments a
            LEFT JOIN insurances i ON a.insurance_id = i.id
            ${dateFilter}
            GROUP BY i.id
        `, params);

        res.json({
            totalRevenue: totalRes[0].totalRevenue || 0,
            revenueByInsurance: insuranceRes
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


const getPatientHistory = async (req, res) => {
    const { email } = req.params;
    try {
        const history = await PatientHistory.findOne({ patientEmail: email });
        if (!history) return res.status(404).json({ message: 'Patient history not found in MongoDB' });
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getDoctors,
    getDoctorById,
    createDoctor,
    updateDoctor,
    deleteDoctor,
    getRevenueReport,
    getPatientHistory
};
