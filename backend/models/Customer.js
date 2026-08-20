const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Model: customers
 *
 * Master data customer per-AGENT. Terisi dari dua jalur:
 *   1. OTOMATIS — saat AI mengirim SUMMARY ke customer di WhatsApp, data customer
 *      (phone dari WA, name dari perkenalan di chat / ditanya AI, email bila
 *      diberikan saat penjadwalan viewing) didaftarkan sekali. Kunjungan berikutnya
 *      dikenali via (user_id, phone) — tidak insert ulang.
 *   2. MANUAL — agent mendaftarkan sendiri lewat module Customer Master.
 *
 * UNIQUE constraint: (user_id, phone) — 1 customer bisa chat ke BEBERAPA agent
 * ElevanLab (baris terpisah per agent) dan boleh memakai nama berbeda antar agent.
 *
 * ai_response: ON = AI membalas chat customer ini; OFF = AI diam (takeover manual agent).
 * Status: 1 = aktif, 2 = disabled/blocked, 3 = deleted (soft delete)
 * FK user_id, created_by & updated_by → users.user_id
 */
const Customer = sequelize.define('Customer', {
  user_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'FK ke users.user_id — agent pemilik relasi customer ini'
  },
  customer_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: 'Generated ID: prefix nama + random alphanumeric + count padded 3 digit'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Nama customer (dari perkenalan chat, ditanya AI, atau input agent)'
  },
  phone: {
    type: DataTypes.STRING(30),
    allowNull: false,
    comment: 'Nomor WhatsApp customer (otomatis dari chat)'
  },
  email: {
    type: DataTypes.STRING(200),
    allowNull: true,
    defaultValue: null,
    comment: 'Email customer (ditanya AI saat penjadwalan viewing; nullable)'
  },
  ai_response: {
    type: DataTypes.STRING(5),
    allowNull: false,
    defaultValue: 'ON',
    comment: 'ON = AI membalas customer ini; OFF = AI diam (agent takeover manual)'
  },
  ask_name: {
    type: DataTypes.STRING(5),
    allowNull: false,
    defaultValue: 'NO',
    comment: 'AI akan menanyakan nama orang di WhatsApp, jika nama dijawab oleh orang di WhatsApp; maka ask_name menjadi YES'
  },
  status: {
    type: DataTypes.INTEGER(1),
    allowNull: false,
    defaultValue: 1,
    comment: '1 = aktif, 2 = disabled/blocked, 3 = deleted (soft delete)'
  },
  created_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Tanggal pembuatan data'
  },
  created_by: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'FK ke users.user_id — agent yang mendaftarkan (AI memakai user_id agent)'
  },
  updated_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    defaultValue: null,
    comment: 'Tanggal update terakhir'
  },
  updated_by: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: null,
    comment: 'FK ke users.user_id — siapa yang terakhir mengubah'
  }
}, {
  tableName: 'customers',
  timestamps: false,
  indexes: [
    { fields: ['customer_id'] },
    // 1 customer per agent — phone unik DALAM scope agent (bisa beda nama antar agent)
    { unique: true, fields: ['user_id', 'phone'], name: 'uq_customers_user_phone' },
    { fields: ['user_id'] },
    { fields: ['phone'] },
    { fields: ['status'] },
    { fields: ['name'] }
  ]
});

module.exports = Customer;
