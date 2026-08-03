const express = require('express');

const cors = require('cors');
const helmet = require('helmet');
const taskRoutes = require('./routes/tasks');
const errorHandler = require('./middleware/errorHandler');
const { notFoundHandler } = require('./middleware/errorHandler');
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Limiter la taille des payloads JSON

// Health check
app.get('/health', (req, res) => {
res.json({ status: 'ok', timestamp: new Date() });
});

// Routes
app.use('/api/tasks', taskRoutes);

// Gestion des routes non trouvées (404)
app.use(notFoundHandler);

// Error handling
app.use(errorHandler);

module.exports = app;