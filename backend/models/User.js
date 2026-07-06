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
 * - catalog_summary : ON = Summary with catalog, OFF = Summary without catalog (nullable)
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
