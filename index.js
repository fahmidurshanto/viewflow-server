const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const initReminderScheduler = require('./services/scheduler');

dotenv.config();

// Production check for JWT Secret
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'viewflow_jwt_secret_key')) {
  console.warn('⚠️ WARNING: Using weak or default JWT_SECRET in production is highly insecure. Please set a strong JWT_SECRET.');
}

const app = express();

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Express 5 compatible NoSQL Injection Sanitization
const sanitizeNoSQL = (obj) => {
  if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete obj[key];
      } else if (typeof obj[key] === 'object') {
        sanitizeNoSQL(obj[key]);
      }
    }
  }
};

app.use((req, res, next) => {
  if (req.body) sanitizeNoSQL(req.body);
  if (req.params) sanitizeNoSQL(req.params);
  next();
});

// General API Rate Limiting (500 requests per 15 minutes)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use('/api', generalLimiter);

// Strict Rate Limiting for Auth Endpoints (15 attempts per 15 minutes to prevent brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again after 15 minutes' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Public Booking Rate Limiting (anti-spam)
const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many booking requests from this network. Please try again later.' }
});
app.use('/api/viewings/public-book', bookingLimiter);

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

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

// Pure Cloud Uploads active (No local disk serving)

// App Routes
app.use('/api/upload', require('./routes/upload'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/viewings', require('./routes/viewings'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/settings', require('./routes/settings'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 ViewFlow API server running on port ${PORT}`);
});
