const mongoose = require('mongoose');
require('dotenv').config();

const connectMongo = async () => {
    try {
        // AQUI VA LA NUEVA CADENA DE CONEXIÓN A MONGODB SI LA USAS
        // Lee la variable desde tu .env o un valor por defecto
        const connectionString = process.env.MONGO_URI || 'mongodb://localhost:27017/tu_base_mongo';
        await mongoose.connect(connectionString);
        console.log('MongoDB Connected to:', connectionString);
    } catch (error) {
        console.error('MongoDB Connection Error:', error);
        process.exit(1);
    }
};

module.exports = connectMongo;
