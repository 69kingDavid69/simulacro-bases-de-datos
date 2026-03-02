const mongoose = require('mongoose');
require('dotenv').config();

const connectMongo = async () => {
    try {
        // AQUI VA LA NUEVA CADENA DE CONEXION MONGO SI CAMBIAS DE BASE DE DATOS
        // EJEMPLO: await mongoose.connect('mongodb://localhost:27017/mi_nueva_bd');
        const connectionString = process.env.MONGO_URI || 'mongodb://localhost:27017/saludplus';
        await mongoose.connect(connectionString);
        console.log('MongoDB Connected to:', connectionString);
    } catch (error) {
        console.error('MongoDB Connection Error:', error);
        process.exit(1);
    }
};

module.exports = connectMongo;
