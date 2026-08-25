/**
 * leadQualificationController.js — DAFTAR LEAD LAYAK FOLLOW-UP (M138)
 *
 * Directive pemilik proyek: "users.privilege yang isi Admin akan memberikan
 * informasi customer yang layak, yaitu nama, nomor whatsapp, summary dari
 * customer yang sudah ngobrol kepada [agent]."
 *
 * Endpoint ini ADMIN-ONLY (requirePrivilege('admin')). Alasannya bukan sekadar
 * mengikuti kalimat directive: hasilnya adalah DAFTAR NOMOR WHATSAPP + isi
 * percakapan lintas-agent. Membiarkan agent biasa mengaksesnya berarti agent A
 * bisa memanen lead agent B — kebocoran data yang seluruh arsitektur per-agent
 * proyek ini (Property.user_id, Customer.user_id, agentCoverageService) memang
 * dibangun untuk mencegah.
 *
 * ⛔ TIDAK menyentuh jalur percakapan sama sekali. Ini alat BACA untuk admin;
 * tidak ada balasan customer yang dihasilkan di sini.
 */

const { Op } = require('sequelize');
const { Customer, User, ChatSession, ChatMessage, DeveloperProperty } = require('../models');
const { HTTP } = require('../utils/httpStatus');
const { sendSuccess, sendError } = require('../utils/responseFormat');
const GeneralController = require('./GeneralController');
const { scoreLead, INDICATORS } = require('../services/leadScoringService');
const { normalizePhone } = require('../utils/whatsappUtils');

/** Ambil transkrip percakapan customer↔agent berdasarkan nomor telepon. */
async function loadTranscriptByPhone(phone, limit = 200) {
  const normalized = normalizePhone(phone);
  if (!normalized) return { history: [], sessionId: null, lastAt: null };

  // Sesi dicocokkan lewat normalizedPhone (kolom yang memang diindeks untuk ini).
  const session = await ChatSession.findOne({
    where: { normalizedPhone: normalized },
    order: [['updatedAt', 'DESC']],
  });
  if (!session) return { history: [], sessionId: null, lastAt: null };

  const rows = await ChatMessage.findAll({
    where: { chatSessionId: session.id },
    order: [['createdAt', 'ASC'], ['id', 'ASC']],   // tie-break id: pesan di ms yang sama tidak terbalik
    limit,
  });

  return {
    sessionId: session.id,
    lastAt: rows.length ? rows[rows.length - 1].createdAt : session.updatedAt,
    history: rows.map(r => ({ role: r.role, message: r.message })),
  };
}

/** Ringkasan singkat percakapan untuk admin — kutipan, BUKAN karangan. */
function buildAdminSummary(history, scoring) {
  const customerMsgs = history
    .filter(m => m.role === 'user' || m.role === 'customer')
    .map(m => String(m.message || '').trim())
    .filter(Boolean);

  if (!customerMsgs.length) return 'Belum ada pesan dari customer.';

  // ⚠️ SENGAJA ekstraktif (kutip pesan asli), BUKAN generatif. Summary yang
  // dipakai admin untuk memutuskan follow-up TIDAK BOLEH hasil karangan LLM —
  // kelas bug M83/M84 (AI mengarang isi summary) sudah mahal diperbaiki, dan di
  // sini taruhannya lebih tinggi: agent akan menelepon orang sungguhan.
  const first = customerMsgs[0];
  const last  = customerMsgs[customerMsgs.length - 1];
  const bits  = [`Pesan pertama: "${first}"`];
  if (customerMsgs.length > 1) bits.push(`Pesan terakhir: "${last}"`);
  bits.push(`Total ${customerMsgs.length} pesan dari customer.`);
  bits.push(scoring.reason);
  return bits.join(' ');
}

class LeadQualificationController {

  /**
   * GET /api/lead/qualified?page=1&tier=serius&agent=<user_id>&search=
   *
   * Admin-only. Mengembalikan customer beserta skor keseriusan, diurutkan dari
   * skor tertinggi supaya yang paling layak muncul lebih dulu.
   */
  static async listQualifiedLeads(req, res) {
    try {
      const page     = Math.max(1, parseInt(req.query.page, 10) || 1);
      const pageSize = GeneralController.pageSize();
      const tierFilter = String(req.query.tier || '').toLowerCase().trim();
      const agentFilter = String(req.query.agent || '').trim();
      const search = String(req.query.search || '').trim();

      const where = { status: { [Op.ne]: 3 } };
      if (agentFilter) where.user_id = agentFilter;
      if (search) {
        where[Op.or] = [
          { name:  { [Op.like]: `%${search}%` } },
          { phone: { [Op.like]: `%${search}%` } },
        ];
      }

      // Ambil SEMUA kandidat dulu — skor dihitung dari transkrip (tidak ada di
      // DB), jadi paginasi harus dilakukan SETELAH scoring & sorting. Aman
      // untuk skala saat ini; bila customers tumbuh sangat besar, langkah
      // berikutnya adalah menyimpan skor ke kolom saat percakapan berlangsung
      // (dicatat di §10 ROADMAP, bukan dikerjakan diam-diam di sini).
      const customers = await Customer.findAll({ where, order: [['id', 'DESC']] });

      const scored = [];
      for (const c of customers) {
        const { history, lastAt } = await loadTranscriptByPhone(c.phone);
        if (!history.length) continue;   // tanpa percakapan tidak ada yang bisa dinilai

        const scoring = scoreLead({ history });
        if (tierFilter && scoring.tier !== tierFilter) continue;

        const agent = await User.findOne({
          where: { user_id: c.user_id },
          attributes: ['user_id', 'name', 'phone', 'developer_property_id'],
        });

        let developerName = null;
        if (agent?.developer_property_id) {
          const dev = await DeveloperProperty.findOne({
            where: { developer_property_id: agent.developer_property_id },
            attributes: ['name'],
          });
          developerName = dev?.name || null;
        }

        scored.push({
          customer_id:   c.customer_id,
          name:          c.name,
          phone:         c.phone,
          email:         c.email,
          agent_user_id: agent?.user_id || c.user_id,
          agent_name:    agent?.name || null,
          agent_developer: developerName,
          score:         scoring.score,
          max_score:     scoring.maxScore,
          percent:       scoring.percent,
          tier:          scoring.tier,
          is_serious:    scoring.isSerious,
          matched_indicators: scoring.matched.map(m => m.key),
          missing_indicators: scoring.missing.map(m => m.key),
          summary:       buildAdminSummary(history, scoring),
          last_activity: lastAt,
        });
      }

      // Skor tertinggi dulu; tie-break aktivitas terbaru.
      scored.sort((a, b) => b.score - a.score
        || new Date(b.last_activity || 0) - new Date(a.last_activity || 0));

      const total      = scored.length;
      const totalPages = Math.ceil(total / pageSize);
      const offset     = (page - 1) * pageSize;
      const paged      = scored.slice(offset, offset + pageSize)
        .map((row, i) => ({ no: offset + i + 1, ...row }));

      return sendSuccess(res, HTTP.OK, {
        leads: paged,
        indicators: INDICATORS.map(i => ({ key: i.key, label: i.label, weight: i.weight })),
        counts: {
          serius:        scored.filter(s => s.tier === 'serius').length,
          potensial:     scored.filter(s => s.tier === 'potensial').length,
          belum_serius:  scored.filter(s => s.tier === 'belum serius').length,
        },
        pagination: {
          total, page, pageSize, totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      }, 'Data lead berhasil dimuat');

    } catch (error) {
      console.error('[LEAD QUALIFIED ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memuat data lead: ' + (error.message || 'Unknown error'));
    }
  }

  /**
   * GET /api/lead/detail/:phone
   * Admin-only. Skor + transkrip penuh satu customer.
   */
  static async getLeadDetail(req, res) {
    const { phone } = req.params;
    try {
      const { history, sessionId, lastAt } = await loadTranscriptByPhone(phone, 500);
      if (!history.length) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Percakapan untuk nomor ini tidak ditemukan');
      }

      const scoring  = scoreLead({ history });
      const customer = await Customer.findOne({
        where: { phone: { [Op.like]: `%${String(phone).slice(-9)}` }, status: { [Op.ne]: 3 } },
      });

      return sendSuccess(res, HTTP.OK, {
        lead: {
          phone,
          name:        customer?.name || null,
          customer_id: customer?.customer_id || null,
          session_id:  sessionId,
          score:       scoring.score,
          max_score:   scoring.maxScore,
          percent:     scoring.percent,
          tier:        scoring.tier,
          is_serious:  scoring.isSerious,
          matched:     scoring.matched,
          missing:     scoring.missing,
          summary:     buildAdminSummary(history, scoring),
          last_activity: lastAt,
          transcript:  history,
        },
      }, 'Detail lead berhasil dimuat');

    } catch (error) {
      console.error('[LEAD DETAIL ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memuat detail lead');
    }
  }
}

module.exports = LeadQualificationController;
module.exports.loadTranscriptByPhone = loadTranscriptByPhone;
module.exports.buildAdminSummary = buildAdminSummary;
