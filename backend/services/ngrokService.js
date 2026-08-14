const { spawn } = require('child_process');
const readline = require('readline');
const axios = require('axios');

let ngrokProcess = null;

// Cache modul-level dari URL publik ngrok TERAKHIR yang diketahui — dibaca oleh
// propertyImageService (dan pemanggil lain yang butuh basis URL publik untuk
// dev tanpa domain sungguhan). Diisi dari KEDUA jalur resolusi URL (tunnel yang
// sudah ada MAUPUN tunnel baru) supaya konsisten dari sisi manapun ngrok start.
let cachedPublicUrl = null;

/** URL publik ngrok terakhir yang diketahui, atau null bila belum ada tunnel. */
function getCachedNgrokUrl() {
  return cachedPublicUrl;
}

// ngrok local inspector API — selalu di 127.0.0.1:4040 kecuali di-override user
// lewat --inspect (tidak dipakai proyek ini). Dipakai untuk cek apakah SUDAH ada
// tunnel ngrok yang jalan (mis. proses lama yang orphan setelah nodemon restart)
// sebelum spawn proses baru — mencegah ERR_NGROK_334 (akun free ngrok hanya boleh
// 1 tunnel aktif bersamaan).
const NGROK_API = 'http://127.0.0.1:4040/api/tunnels';

/**
 * Cek apakah ngrok sudah punya tunnel aktif ke port ini (proses lama yang belum
 * mati, biasanya tertinggal dari nodemon restart yang tidak mematikan child
 * process ngrok dengan bersih di Windows). Non-destruktif — hanya membaca API
 * lokal ngrok, tidak mematikan proses apa pun.
 *
 * @param {number} port
 * @returns {Promise<string|null>} public URL bila ketemu, null bila tidak ada/gagal cek
 */
async function findExistingTunnel(port) {
  try {
    const res = await axios.get(NGROK_API, { timeout: 1500 });
    const tunnels = res.data?.tunnels || [];
    const match = tunnels.find((t) =>
      t.proto === 'https' && String(t.config?.addr || '').includes(String(port))
    );
    return match?.public_url || null;
  } catch {
    return null; // ngrok belum jalan / API belum siap — normal, lanjut spawn baru
  }
}

// Menjalankan `ngrok http <port> --log=stdout --log-format=json` sebagai child process
// dari backend (bukan window terminal terpisah). Output JSON di-parse untuk ambil
// public URL, lalu di-print ke console backend yang sama.
async function startNgrok(port) {
  // Reuse tunnel yang sudah jalan (mis. orphan dari restart sebelumnya) alih-alih
  // spawn baru dan bentrok ERR_NGROK_334 ("endpoint already online").
  const existing = await findExistingTunnel(port);
  if (existing) {
    console.log('[NGROK] Tunnel sudah aktif, pakai yang ada:', existing);
    cachedPublicUrl = existing;
    return existing;
  }

  return new Promise((resolve, reject) => {
    const domain = (process.env.NGROK_DOMAIN || '').trim();
    const region = (process.env.NGROK_REGION || '').trim();
    const authtoken = (process.env.NGROK_AUTHTOKEN || '').trim();

    const args = ['http', String(port), '--log=stdout', '--log-format=json'];
    if (domain) args.push(`--domain=${domain}`);
    if (region) args.push(`--region=${region}`);

    // ── AUTHTOKEN DARI .env — SUMBER KEBENARAN (14 Agu 2026) ────────────────
    // Sebelumnya service ini TIDAK pernah membaca NGROK_AUTHTOKEN sama sekali;
    // tunnel hanya jalan karena kebetulan ada authtoken di config file MESIN
    // (`%LOCALAPPDATA%\ngrok\ngrok.yml`) hasil `ngrok config add-authtoken`.
    // Akibatnya .env terlihat mengatur token padahal tidak berpengaruh apa-apa,
    // dan di mesin/server BARU (yang punya .env tapi belum pernah menjalankan
    // add-authtoken) tunnel gagal dengan ERR_NGROK_105 — padahal tokennya jelas
    // tertulis di .env.
    //
    // ⚠️ HARUS flag CLI, BUKAN environment variable. Diuji langsung pada ngrok
    // v3.39.8: dengan NGROK_AUTHTOKEN sengaja diisi nilai SALAH lewat env child
    // process, tunnel TETAP berhasil — artinya CONFIG FILE MENANG atas env var.
    // Hanya flag baris perintah yang presedensinya di atas config file, jadi
    // hanya itu yang benar-benar menjadikan .env otoritatif.
    //
    // ⚠️ KONSEKUENSI: token ikut terlihat di daftar proses OS (Task Manager /
    // `ps`). Itu paparan LOKAL di mesin yang sama, dan diterima secara sadar
    // sebagai harga agar .env benar-benar berlaku. Yang TIDAK boleh terjadi
    // adalah token bocor ke LOG — karena log bisa ikut terkirim/tersimpan.
    // Semua keluaran ngrok di bawah karenanya dilewatkan redact() dulu.
    if (authtoken) {
      args.push(`--authtoken=${authtoken}`);
    } else {
      console.warn('[NGROK] NGROK_AUTHTOKEN kosong di .env — memakai authtoken dari config file ngrok (bila ada). Di mesin baru ini akan gagal ERR_NGROK_105.');
    }

    /** Sensor token dari teks apa pun sebelum di-log. */
    const redact = (text) => {
      const s = String(text ?? '');
      return authtoken ? s.split(authtoken).join('***REDACTED***') : s;
    };

    ngrokProcess = spawn('ngrok', args);

    const rl = readline.createInterface({ input: ngrokProcess.stdout });
    let resolved = false;
    // Simpan error TERAKHIR yang bermakna (bukan reject di baris eror PERTAMA) —
    // ngrok kadang log baris "eror" transien (mis. "open config file") lalu tetap
    // lanjut jalan; baris eror yang benar-benar fatal biasanya muncul belakangan
    // (mis. ERR_NGROK_334) tepat sebelum proses exit. Reject dilakukan saat exit,
    // pakai pesan PALING INFORMATIF yang tertangkap, bukan yang pertama muncul.
    let lastError = null;

    rl.on('line', (line) => {
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        return; // baris non-JSON, abaikan
      }

      if (entry.msg === 'started tunnel' && entry.url) {
        if (!resolved) {
          resolved = true;
          cachedPublicUrl = entry.url;
          resolve(entry.url);
        }
      }

      if (entry.lvl === 'eror' || entry.err) {
        const msg = redact(entry.msg || entry.err);
        console.error('[NGROK ERROR]', msg);
        lastError = msg; // catat, JANGAN langsung reject — lihat komentar di atas
      }
    });

    ngrokProcess.stderr.on('data', (data) => {
      const text = redact(data.toString().trim());
      console.error('[NGROK STDERR]', text);
      // ngrok CLI kadang tulis error fatal (mis. ERR_NGROK_334) ke stderr sebagai
      // teks biasa, bukan JSON stdout — tangkap juga sebagai kandidat lastError.
      const codeMatch = text.match(/ERR_NGROK_\d+/);
      if (codeMatch) lastError = text;
    });

    ngrokProcess.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    ngrokProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.warn(`[NGROK] Process exited with code ${code}`);
        if (!resolved) {
          resolved = true;
          reject(new Error(lastError || `ngrok exited with code ${code}`));
        }
      }
      ngrokProcess = null;
    });

    // Timeout jaga-jaga jika ngrok tidak merespon dalam 20s
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error(lastError || 'ngrok timeout: tidak ada tunnel URL dalam 20 detik'));
      }
    }, 20000);
  });
}

function stopNgrok() {
  if (ngrokProcess) {
    ngrokProcess.kill();
    ngrokProcess = null;
  }
}

module.exports = { startNgrok, stopNgrok, getCachedNgrokUrl };
