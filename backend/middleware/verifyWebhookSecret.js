'use strict';
/**
 * verifyWebhookSecret.js — gerbang opsional untuk webhook WhatsApp masuk (M153)
 * -------------------------------------------------------------------------------
 * TEMUAN AUDIT (25 Agu 2026): /api/kirimi/webhook, /api/fonnte-chat/webhook,
 * /api/timelinesai/webhook (dan varian -raw serta /fonnte/webhook legacy) HANYA
 * dilindungi rate-limiter (120 req/menit) — TIDAK ADA verifikasi bahwa request
 * benar-benar berasal dari Kirimi/Fonnte/TimelinesAI. URL-nya publik dan bisa
 * ditebak (pola standar "/api/<provider>/webhook"); siapa pun yang tahu URL bisa
 * POST payload yang meniru pesan customer dari nomor mana pun, ke agent mana pun,
 * dan memicu balasan AI sungguhan (memakan kredit LLM berbayar) atau mengotori
 * riwayat chat/skor lead agent dengan data palsu.
 *
 * Ketiga provider ini TIDAK menandatangani payload webhook (bukan seperti
 * Stripe/GitHub yang mengirim HMAC signature) — jadi satu-satunya pertahanan
 * praktis adalah SHARED SECRET yang kita tentukan sendiri, disisipkan sebagai
 * query string pada URL webhook yang didaftarkan di dashboard masing-masing
 * provider, mis.:
 *   https://propmatches.fun/api/kirimi/webhook?token=<WEBHOOK_SHARED_SECRET>
 *
 * ⚠️ FAIL-OPEN BILA BELUM DIKONFIGURASI — SENGAJA.
 * Webhook produksi SEDANG BERJALAN dengan URL yang SUDAH terdaftar di 3 dashboard
 * eksternal (Kirimi/Fonnte/TimelinesAI) tanpa token. Mengaktifkan penegakan
 * secara default akan MEMATIKAN seluruh trafik WhatsApp masuk sampai pemilik
 * proyek memperbarui URL di ketiga dashboard itu — perubahan pada sistem
 * eksternal yang bukan wewenang kode ini untuk memutuskan sendiri. Karena itu:
 *   • WEBHOOK_SHARED_SECRET belum di-set di .env → middleware lewat begitu saja
 *     (perilaku hari ini, tidak berubah) TAPI mencatat peringatan SEKALI per
 *     proses supaya tidak terlewat di log.
 *   • WEBHOOK_SHARED_SECRET sudah di-set → wajib cocok, selain itu 401.
 *
 * Untuk mengaktifkan: isi WEBHOOK_SHARED_SECRET di .env, lalu perbarui URL
 * webhook di dashboard Kirimi, Fonnte, dan TimelinesAI supaya menyertakan
 * `?token=<nilai yang sama>`.
 */

let _warnedOnce = false;

function verifyWebhookSecret(req, res, next) {
  const expected = String(process.env.WEBHOOK_SHARED_SECRET || '').trim();

  if (!expected) {
    if (!_warnedOnce) {
      _warnedOnce = true;
      console.warn(
        '[SECURITY] ⚠️ WEBHOOK_SHARED_SECRET belum di-set — endpoint webhook WhatsApp '
        + '(kirimi/fonnte/timelinesai) TIDAK diverifikasi, hanya dibatasi rate-limit. '
        + 'Lihat middleware/verifyWebhookSecret.js untuk cara mengaktifkan.'
      );
    }
    return next();
  }

  const provided = String(req.query.token || req.headers['x-webhook-token'] || '').trim();
  if (provided && provided === expected) return next();

  console.warn(`[SECURITY] ❌ Webhook ditolak — token tidak cocok/kosong (${req.method} ${req.originalUrl}, IP ${req.ip})`);
  return res.status(401).json({ success: false, message: 'Unauthorized webhook request.' });
}

module.exports = { verifyWebhookSecret };
