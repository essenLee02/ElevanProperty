const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Model: users
 *
 * Field sesuai requirement user:
 * - id            : auto-increment primary key (default Sequelize)
 * - user_id       : generated identifier (prefix nama + random alphanumeric + count+1)
 * - name          : nama lengkap user
 * - birthdate     : tanggal lahir
 * - phone         : nomor telepon
 * - username      : login username (unique)
 * - password      : bcrypt hashed password
 * - refresh_token : JWT refresh token disimpan saat login (rotasi setiap refresh)
 * - updated_date  : timestamp update terakhir
 * - update_by     : siapa yang melakukan update terakhir
 * - created_date  : timestamp pendaftaran
 * - created_by    : siapa yang melakukan registrasi (default 'Self-Register')
 * - status        : 1 = aktif, 2 = blocked, 3 = delete
 * - privilege     : level akses / role (nullable)
 * - fonnte_token     : Fonnte token milik agent (untuk kirim WA via Fonnte, nullable)
 * - kirimi_device_id : Device ID Kirimi milik agent (mis. "D-3OCA6"; user_code & secret di .env, nullable)
 * - email          : alamat email user (nullable)
 * - developer_property_id : FK ke developer_properties — brand agensi tempat
 *                     agent bernaung (Ray White/Brighton/dst). Dipakai AI untuk
 *                     menjawab "agent ini dari mana?" dengan data, bukan tebakan.
 * - catalog_summary : ON = Summary with catalog, OFF = Summary without catalog (nullable)
 * - ai_primary      : AI provider pilihan agent untuk terminal message
 *                     ("Default" = ikut backend/.env AI_PRIMARY_PROVIDER)
 * - trans_type      : Sale | Rent | Both — jenis transaksi yang dilayani agent
 * - payment_type    : Cash | KPR | Both — TERIKAT trans_type (lihat utils/userBusinessRules.js)
 * - rental_duration : minimal durasi sewa (angka), hanya untuk Rent/Both
 * - rental_type     : satuan durasi sewa (Day/Week/Month/Year/Night), hanya untuk Rent/Both
 *
 * ⚠️ trans_type ↔ payment_type ↔ rental_* SALING TERIKAT. Aturannya TIDAK
 * di-hardcode di controller mana pun — satu sumber kebenaran ada di
 * utils/userBusinessRules.js (dipakai register, profile, dan tes).
 */
const User = sequelize.define('User', {
  user_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  birthdate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    defaultValue: null
  },
  phone: {
    type: DataTypes.STRING(30),
    allowNull: true,
    defaultValue: null
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  catalog_summary: {
    type: DataTypes.STRING(5),
    allowNull: true,
    defaultValue: null // ON=Summary with catlog, OFF=Summary without catalog
  },
  refresh_token: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null
  },
  developer_property_id: {
    type: DataTypes.STRING(30),
    allowNull: true,
    defaultValue: null,
    comment: 'FK ke developer_properties.developer_property_id — brand agensi/'
           + 'brokerage tempat agent bernaung (Ray White, Brighton, Xavier Marks, dst). '
           + 'Nullable: agent independen / data lama yang belum dipetakan.'
  },
  status: {
    type: DataTypes.INTEGER(1),
    allowNull: false,
    defaultValue: 1   // 1=aktif, 2=blocked, 3=delete
  },
  privilege: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: null
  },
  ai_primary: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'Default',
    comment: 'Penggunaan API pada terminal massages: Deepseek, Kimi, Default (ikut backend/.env AI_PRIMARY_PROVIDER). Nilai lain (Qwen, Chat GPT, Claude, Private) tetap diterima bila di-set langsung di DB.'
  },
  trans_type: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'Both',
    comment: 'Transaction Type: Sale, Rent, Both (Sale and Rent)'
  },
  payment_type: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'Cash',
    comment: 'Payment Type: Cash, KPR, Both. TERIKAT trans_type — Rent→Cash saja; Both→Both saja; Sale→bebas (Cash/KPR/Both)'
  },
  rental_duration: {
    type: DataTypes.INTEGER(5),
    allowNull: true,
    defaultValue: null,
    comment: 'Minimal durasi sewa (angka). Hanya bila trans_type Rent/Both; untuk Sale WAJIB null'
  },
  rental_type: {
    type: DataTypes.STRING(30),
    allowNull: true,
    defaultValue: null,
    comment: 'Satuan periode durasi sewa: Day, Week, Month, Year, Night. Hanya bila trans_type Rent/Both; untuk Sale WAJIB null'
  },
  fonnte_token: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: null,
    comment: 'Fonnte token milik agent (untuk kirim WA via Fonnte)'
  },
  kirimi_device_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: null,
    comment: 'Device ID Kirimi milik agent (mis. D-3OCA6). user_code & secret akun di .env (KIRIMI_USER_CODE/KIRIMI_SECRET)'
  },
  created_date: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  },
  created_by: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: null
  },
  updated_date: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  },
  update_by: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: null
  }
}, {
  tableName: 'users',
  timestamps: false,    // pakai created_date / updated_date custom sesuai requirement
  indexes: [
    { fields: ['user_id'] },
    { fields: ['username'] },
    { fields: ['status'] },
    { fields: ['privilege', 'status'] },
    { fields: ['phone'] }                  // For phone matching in AgentLookup
  ]
});

module.exports = User;
