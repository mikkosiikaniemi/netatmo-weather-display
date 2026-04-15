import express = require('express');
import cookieParser = require('cookie-parser');
import cors = require('cors');
import authRoutes = require('./routes/auth');
import apiRoutes = require('./routes/api');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const SESSION_SECRET = process.env.SESSION_SECRET || 'local-netatmo-session-secret';

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? FRONTEND_ORIGIN
    : FRONTEND_ORIGIN,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser(SESSION_SECRET));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal Server Error'
      : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
