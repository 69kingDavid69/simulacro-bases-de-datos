const express = require('express');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

// Configs
const connectMongo = require('./config/db.mongo');

// Routes
const apiRoutes = require('./routes/api.route');

const app = express();
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists for Multer
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Initialize Databases
connectMongo();

// Register API Routes under /api
app.use('/api', apiRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`SaludPlus API running on http://localhost:${PORT}`);
});
