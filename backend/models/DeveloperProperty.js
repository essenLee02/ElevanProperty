const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Model: developer_properties
 *
 * Master data DEVELOPER/BRAND agensi properti tempat seorang agent bernaung —
 * mis. Ray White, ERA Property, Xavier Marks, Galaxy Property, Brighton,
 * Propnex, Propmatches.
 *
 * Dipakai oleh `users.developer_property_id` (FK) supaya AI bisa menjawab
 * pertanyaan customer "ini dari developer/agensi mana?" dengan DATA, bukan
 * tebakan — kelas bug M84/M96 (AI mengarang nama) yang sudah mahal diperbaiki
 * berkali-kali di proyek ini.
 *
 * ⚠️ CATATAN ISTILAH (penting saat membaca kode/skill doc): kolom & tabel ini
 * memakai kata "developer" mengikuti istilah yang dipakai pemilik proyek,
 * TAPI isinya sebenarnya BRAND AGENSI/BROKERAGE (Ray White dkk.), BUKAN
 * developer/pengembang perumahan (Ciputra, Sinarmas Land, dst.). Keduanya hal
 * berbeda di industri properti Indonesia. Bila suatu saat perlu menyimpan
 * pengembang perumahan yang sesungguhnya, itu tabel TERPISAH — jangan
 * dicampur ke sini.
 *
 * Status: 1 = aktif, 2 = disabled/blocked, 3 = deleted (soft delete)
 * FK created_by & updated_by → users.user_id
 */
const DeveloperProperty = sequelize.define('DeveloperProperty', {
  developer_property_id: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true,
    comment: 'Generated ID: prefix nama + random alphanumeric + count padded 3 digit'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
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
    comment: 'FK ke users.user_id — siapa yang membuat'
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
  tableName: 'developer_properties',
  timestamps: false,
  indexes: [
    { fields: ['developer_property_id'] },
    { fields: ['status'] },
    { fields: ['name'] }
  ]
});

module.exports = DeveloperProperty;
