/**
 * customerMasterController.js
 *
 * CRUD controller untuk master customer (Customer).
 *
 * Data customer terisi dari 2 jalur:
 *   1. OTOMATIS — AI mendaftarkan saat mengirim SUMMARY ke customer WhatsApp
 *      (customerRegistrationService; created_by = user_id agent).
 *   2. MANUAL — agent input sendiri lewat module Customer Master (controller ini).
 *
 * customer_id formula: prefix nama (2 huruf) + random 5 alphanumeric + count 3 digit.
 * UNIQUE (user_id, phone): 1 customer bisa terdaftar di beberapa agent, nama boleh beda.
 * ai_response: ON = AI membalas chat customer ini; OFF = AI diam (takeover agent).
 * Status: 1 = aktif, 2 = disabled/blocked, 3 = deleted (soft delete)
 */

const { Op } = require('sequelize');
const { Customer, User } = require('../models');
const { HTTP }           = require('../utils/httpStatus');
const { sendSuccess, sendError } = require('../utils/responseFormat');
const GeneralController = require('./GeneralController');

/** Normalisasi nomor telepon ke digit 62xxx (samakan dengan registrasi via chat). */
function normPhone(p) {
  if (!p) return null;
  let s = String(p).replace(/\D/g, '');
  if (!s) return null;
  if (s.startsWith('0')) s = '62' + s.slice(1);
  return s;
}

class CustomerMasterController extends GeneralController {

  static #row(c, extra = {}) {
    return {
      id:            c.id,
      customer_id:   c.customer_id,
      user_id:       c.user_id,
      name:          c.name,
      phone:         c.phone,
      email:         c.email,
      ai_response:   c.ai_response,
      status:        c.status,
      status_label:  c.status === 1 ? 'Aktif' : 'Disabled',
      created_date:  c.created_date,
      created_by:    c.created_by,
      updated_date:  c.updated_date,
      updated_by:    c.updated_by,
      ...extra,
    };
  }

  /* ──────────────────────────────────────────────────────────────────────────
     INSERT — agent mendaftarkan customer manual
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * POST /api/customer/insert
   * Body: { name, phone?, email?, ai_response? }
   * user_id customer = agent yang login (req.user.userId).
   */
  static async insertDataCustomer(req, res) {
    const { name, phone, email, ai_response } = req.body;
    const createdBy = req.user?.userId || null;

    if (!name || !String(name).trim()) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Nama customer wajib diisi');
    }
    if (!createdBy) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Sesi tidak valid, silakan login ulang');
    }
    if (email && !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(String(email).trim())) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Format email tidak valid');
    }
    const aiResp = String(ai_response || 'ON').toUpperCase() === 'OFF' ? 'OFF' : 'ON';
    const phoneNorm = normPhone(phone);

    try {
      // UNIQUE (user_id, phone) — customer dengan nomor sama sudah terdaftar di agent ini?
      if (phoneNorm) {
        const dup = await Customer.findOne({
          where: { user_id: String(createdBy).toUpperCase(), phone: phoneNorm, status: { [Op.ne]: 3 } },
        });
        if (dup) {
          return sendError(
            res, HTTP.CONFLICT, null,
            `Nomor ${phoneNorm} sudah terdaftar sebagai customer "${dup.name}" (${dup.customer_id}). Hindari data duplikat.`
          );
        }
      }

      const total = await Customer.count();
      const idCustomer = GeneralController.generateRandomId(name, total).toUpperCase();

      const newCustomer = await Customer.create({
        user_id:      String(createdBy).toUpperCase(),
        customer_id:  idCustomer,
        name:         String(name).trim(),
        phone:        phoneNorm,
        email:        email ? String(email).trim().toLowerCase() : null,
        ai_response:  aiResp,
        status:       1,
        created_date: GeneralController.todayDate(),
        created_by:   String(createdBy).toUpperCase(),
        updated_date: null,
        updated_by:   null,
      });

      console.log(`[CUSTOMER] ✅ INSERT — ${newCustomer.customer_id} | "${newCustomer.name}" | By: ${createdBy}`);

      return sendSuccess(res, HTTP.CREATED, {
        customer: CustomerMasterController.#row(newCustomer),
      }, 'Customer berhasil ditambahkan');

    } catch (error) {
      console.error('[CUSTOMER INSERT ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal menambahkan customer: ' + (error.message || 'Unknown error'));
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     UPDATE
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * PUT /api/customer/update/:customer_id
   * Body: { name, phone?, email?, ai_response? }
   */
  static async updateDataCustomer(req, res) {
    const { customer_id } = req.params;
    const { name, phone, email, ai_response } = req.body;
    const updatedBy = req.user?.userId || null;

    if (!customer_id) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'customer_id wajib disertakan');
    }
    if (!name || !String(name).trim()) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Nama customer wajib diisi');
    }
    if (!updatedBy) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Sesi tidak valid, silakan login ulang');
    }
    if (email && !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(String(email).trim())) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Format email tidak valid');
    }

    try {
      const customer = await Customer.findOne({ where: { customer_id, status: { [Op.ne]: 3 } } });
      if (!customer) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Customer tidak ditemukan');
      }

      const phoneNorm = normPhone(phone);
      if (phoneNorm) {
        const dup = await Customer.findOne({
          where: {
            user_id:     customer.user_id,
            phone:       phoneNorm,
            customer_id: { [Op.ne]: customer_id },
            status:      { [Op.ne]: 3 },
          },
        });
        if (dup) {
          return sendError(
            res, HTTP.CONFLICT, null,
            `Nomor ${phoneNorm} sudah dipakai customer "${dup.name}" (${dup.customer_id}).`
          );
        }
      }

      const patch = {
        name:         String(name).trim(),
        phone:        phoneNorm,
        email:        email ? String(email).trim().toLowerCase() : null,
        updated_date: GeneralController.todayDate(),
        updated_by:   String(updatedBy).toUpperCase(),
      };
      if (ai_response !== undefined) {
        patch.ai_response = String(ai_response).toUpperCase() === 'OFF' ? 'OFF' : 'ON';
      }
      await customer.update(patch);

      console.log(`[CUSTOMER] ✏️  UPDATE — ${customer.customer_id} | "${customer.name}" | By: ${updatedBy}`);

      const updaterName = await GeneralController.resolveUserName(updatedBy);
      return sendSuccess(res, HTTP.OK, {
        customer: CustomerMasterController.#row(customer, { updated_by_name: updaterName }),
      }, 'Customer berhasil diperbarui');

    } catch (error) {
      console.error('[CUSTOMER UPDATE ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memperbarui customer: ' + (error.message || 'Unknown error'));
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     LIST (pagination + search; default scope: customer milik agent yang login)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * GET /api/customer/list?page=1&search=&ai_response=&all=
   * Default: hanya customer milik agent yang login (user_id = req.user.userId).
   * ?all=1 → semua agent (mis. untuk owner/admin melihat keseluruhan).
   */
  static async showDataCustomer(req, res) {
    try {
      const page     = Math.max(1, parseInt(req.query.page, 10) || 1);
      const pageSize = GeneralController.pageSize();
      const offset   = (page - 1) * pageSize;
      const search   = req.query.search ? String(req.query.search).trim() : '';
      const aiResp   = req.query.ai_response ? String(req.query.ai_response).trim().toUpperCase() : '';
      const showAll  = String(req.query.all || '') === '1';
      const userId   = req.user?.userId || null;

      const where = { status: { [Op.ne]: 3 } };
      if (!showAll && userId) where.user_id = String(userId).toUpperCase();
      // Search HANYA nama, email, phone — customer_id sengaja tidak diikutkan
      // (bukan sesuatu yang customer/agent ketik natural saat mencari).
      if (search) {
        where[Op.or] = [
          { name:  { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { phone: { [Op.like]: `%${search}%` } },
        ];
      }
      if (aiResp === 'ON' || aiResp === 'OFF') where.ai_response = aiResp;

      const { count, rows } = await Customer.findAndCountAll({
        where,
        order:  [['name', 'ASC']],
        limit:  pageSize,
        offset,
      });

      const totalPages = Math.ceil(count / pageSize);

      // Resolve nama agent dalam batch (hindari N+1)
      const agentIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
      const agentRows = agentIds.length
        ? await User.findAll({ where: { user_id: { [Op.in]: agentIds } }, attributes: ['user_id', 'name'] })
        : [];
      const agentMap = Object.fromEntries(agentRows.map(a => [a.user_id, a.name]));

      const customers = rows.map((c, index) => CustomerMasterController.#row(c, {
        no:         offset + index + 1,
        agent_name: agentMap[c.user_id] || '-',
      }));

      return sendSuccess(res, HTTP.OK, {
        customers,
        pagination: {
          total:       count,
          page,
          pageSize,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      }, 'Data customer berhasil dimuat');

    } catch (error) {
      console.error('[CUSTOMER LIST ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memuat data customer');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     DETAIL (untuk halaman edit)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * GET /api/customer/detail/:customer_id
   */
  static async getDetailCustomer(req, res) {
    const { customer_id } = req.params;
    try {
      const customer = await Customer.findOne({ where: { customer_id, status: { [Op.ne]: 3 } } });
      if (!customer) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Customer tidak ditemukan');
      }

      const creatorName = await GeneralController.resolveUserName(customer.created_by);
      const updaterName = await GeneralController.resolveUserName(customer.updated_by);
      const agentName   = await GeneralController.resolveUserName(customer.user_id);

      return sendSuccess(res, HTTP.OK, {
        customer: CustomerMasterController.#row(customer, {
          agent_name:      agentName,
          created_by_name: creatorName,
          updated_by_name: updaterName,
        }),
      }, 'Detail customer berhasil dimuat');

    } catch (error) {
      console.error('[CUSTOMER DETAIL ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memuat detail customer');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     TOGGLE STATUS (Aktif ↔ Disabled) & TOGGLE AI-RESPONSE (ON ↔ OFF)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * PATCH /api/customer/toggle-status/:customer_id
   */
  static async toggleStatusCustomer(req, res) {
    const { customer_id } = req.params;
    const updatedBy = req.user?.userId || null;

    try {
      const customer = await Customer.findOne({ where: { customer_id, status: { [Op.ne]: 3 } } });
      if (!customer) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Customer tidak ditemukan');
      }

      const newStatus = customer.status === 1 ? 2 : 1;
      const label     = newStatus === 1 ? 'Aktif' : 'Disabled';

      await customer.update({
        status:       newStatus,
        updated_date: GeneralController.todayDate(),
        updated_by:   String(updatedBy).toUpperCase(),
      });

      console.log(`[CUSTOMER] 🔄 TOGGLE STATUS — ${customer.customer_id} | "${customer.name}" | ${label} | By: ${updatedBy}`);

      return sendSuccess(res, HTTP.OK, {
        customer: CustomerMasterController.#row(customer),
      }, `Customer "${customer.name}" berhasil diubah menjadi ${label}`);

    } catch (error) {
      console.error('[CUSTOMER TOGGLE ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal mengubah status customer');
    }
  }

  /**
   * PATCH /api/customer/toggle-ai/:customer_id
   * ON ↔ OFF — OFF = AI berhenti membalas customer ini (takeover manual agent).
   */
  static async toggleAiResponseCustomer(req, res) {
    const { customer_id } = req.params;
    const updatedBy = req.user?.userId || null;

    try {
      const customer = await Customer.findOne({ where: { customer_id, status: { [Op.ne]: 3 } } });
      if (!customer) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Customer tidak ditemukan');
      }

      const newVal = customer.ai_response === 'ON' ? 'OFF' : 'ON';
      await customer.update({
        ai_response:  newVal,
        updated_date: GeneralController.todayDate(),
        updated_by:   String(updatedBy).toUpperCase(),
      });

      console.log(`[CUSTOMER] 🤖 TOGGLE AI — ${customer.customer_id} | "${customer.name}" | ai_response=${newVal} | By: ${updatedBy}`);

      return sendSuccess(res, HTTP.OK, {
        customer: CustomerMasterController.#row(customer),
      }, `AI response untuk "${customer.name}" kini ${newVal}`);

    } catch (error) {
      console.error('[CUSTOMER TOGGLE AI ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal mengubah AI response customer');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     SOFT DELETE (status → 3)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * DELETE /api/customer/delete/:customer_id
   */
  static async deleteCustomer(req, res) {
    const { customer_id } = req.params;
    const updatedBy = req.user?.userId || null;

    try {
      const customer = await Customer.findOne({ where: { customer_id, status: { [Op.ne]: 3 } } });
      if (!customer) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Customer tidak ditemukan atau sudah dihapus');
      }

      await customer.update({
        status:       3,
        updated_date: GeneralController.todayDate(),
        updated_by:   updatedBy,
      });

      console.log(`[CUSTOMER] 🗑️  DELETE — ${customer.customer_id} | "${customer.name}" | By: ${updatedBy}`);

      return sendSuccess(res, HTTP.OK, {
        customer_id: customer.customer_id,
        name:        customer.name,
      }, `Customer "${customer.name}" berhasil dihapus`);

    } catch (error) {
      console.error('[CUSTOMER DELETE ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal menghapus customer');
    }
  }
}

module.exports = CustomerMasterController;
