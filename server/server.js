require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { connectDB } = require('./config/db');

const app = express();
app.set('trust proxy', 1); // needed behind Render/Railway proxies

const origins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim());
app.use(helmet());
app.use(cors({ origin: origins }));
app.use(express.json({ limit: '50kb' }));
app.use(morgan('tiny'));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 600 }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/diseases', require('./routes/diseases'));
app.use('/api', require('./routes/consult'));

app.use((_req, res) => res.status(404).json({ message: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));

// The app works without a database; MongoDB only stores anonymous usage stats.
connectDB().catch((e) => console.warn('MongoDB unavailable, continuing without stats:', e.message));
