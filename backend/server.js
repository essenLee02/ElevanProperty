const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const { DataTypes } = require('sequelize');
const sequelize = require('./config/database');
require('./models');
const routes = require('./routes/index');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({ success: true, message: 'ElevanLabs backend is running.' });
});

app.use('/api', routes);

async function ensureRequiredDatabaseColumns() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    const logsTable = await queryInterface.describeTable('logs');
    if (logsTable && !logsTable.level) {
      await queryInterface.addColumn('logs', 'level', {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'info'
      });
      console.log('Database migration completed: added logs.level column');
    }
  } catch (error) {
    if (!String(error.message || '').toLowerCase().includes('no description found')) {
      console.warn('Database schema check warning:', error.message);
    }
  }
}

sequelize.sync()
  .then(async () => {
    await ensureRequiredDatabaseColumns();
    console.log('Database connected and synced');
    console.log('Environment file loaded from:', path.resolve(__dirname, '.env'));
    console.log('OpenAI key configured:', Boolean(process.env.OPENAI_API_KEY));
    app.listen(port, () => {
      console.log(`Backend listening at http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to sync database:', err);
    process.exit(1);
  });
