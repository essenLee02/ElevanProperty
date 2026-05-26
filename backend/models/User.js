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
 */
const User = sequelize.define('User', {
  user_id: {
    type: DataTypes.STRING,
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
  refresh_token: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null
  },
  updated_date: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  },
  update_by: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null
  },
  created_date: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  },
  created_by: {
    type: DataTypes.STRING,
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
  }
}, {
  tableName: 'users',
  timestamps: false,    // pakai created_date / updated_date custom sesuai requirement
  indexes: [
    { fields: ['user_id'] },
    { fields: ['username'] },
    { fields: ['status'] },
    { fields: ['privilege', 'status'] },  // For agent lookup queries (WATI)
    { fields: ['phone'] }                  // For phone matching in AgentLookup
  ]
});

module.exports = User;
