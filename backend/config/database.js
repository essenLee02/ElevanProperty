const { Sequelize } = require('sequelize');

// ─── SQL QUERY LOGGING ───────────────────────────────────────────────────────
// Secara default Sequelize mencetak SETIAP query ("Executing (default): SELECT …")
// ke terminal. Saat agent membuka frontend (master kota, refresh auth, navigasi),
// ratusan baris SQL membanjiri terminal dan MENGUBUR log chat WhatsApp — membuat
// seolah-olah "terminal error" padahal itu hanya query rutin frontend.
//
// Default: OFF (terminal bersih, fokus ke log chat). Set DB_SQL_LOG=true di .env
// untuk menghidupkan kembali query log saat debugging database.
const sqlLogging = String(process.env.DB_SQL_LOG || 'false').toLowerCase() === 'true'
  ? (msg) => console.log(`[SQL] ${msg}`)
  : false;

const sequelize = new Sequelize(
  process.env.DB_NAME || 'db_property',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: process.env.DB_DIALECT || 'mysql',
    logging: sqlLogging
  }
);

module.exports = sequelize;
