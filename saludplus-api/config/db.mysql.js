const mysql = require('mysql2/promise');
require('dotenv').config();

// AQUI VAN TUS NUEVAS CREDENCIALES MYSQL SI CAMBIAS DE BASE DE DATOS OR SERVIDOR
// PUEDES CAMBIAR LOS VALORES POR DEFECTO AQUI O EN TU ARCHIVO .env
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'saludplus_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;
