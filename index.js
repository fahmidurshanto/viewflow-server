const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const initReminderScheduler = require('./services/scheduler');

dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Database connection
connectDB();

// Initialize scheduler
initReminderScheduler();

// Base API route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'ViewFlow Real Estate CRM Server',
    timestamp: new Date().toISOString()
  });
});

// App Routes
app.use('/api/properties', require('./routes/properties'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/viewings', require('./routes/viewings'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/analytics', require('./routes/analytics'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 ViewFlow API server running on port ${PORT}`);
});
