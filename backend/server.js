require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const routes = require('./routes/index');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Sync database
sequelize.sync()
  .then(() => console.log('Database connected and synced'))
  .catch((err) => console.error('Failed to sync database:', err));

// Use routes (Arahkan semua request /api ke folder routes)
app.use('/api', routes);

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
});
