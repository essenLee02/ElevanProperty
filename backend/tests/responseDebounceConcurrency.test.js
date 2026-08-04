/**
 * responseDebounceConcurrency.test.js
 *
 * Bug produksi nyata (4 Agu 2026): 3-4 balasan AI BERBEDA keluar dalam
 * rentang <2 menit untuk SATU customer, termasuk satu pesan yang terpotong
 * di tengah kalimat. Akar masalah: `_pending.delete(key)` terjadi SEBELUM
 * `onFire` (async, panggilan AI provider — bisa makan beberapa detik)
 * dipanggil. Pesan customer yang tiba SAAT `onFire` PERTAMA masih berjalan
 * membuat batch/timer BARU yang independen → `onFire` KEDUA terpanggil
 * SEMENTARA `onFire` PERTAMA MUNGKIN MASIH BERJALAN — dua panggilan AI
 * paralel untuk sesi yang sama, membaca snapshot state berbeda, mengambil
 * keputusan "pertanyaan berikutnya" yang berbeda, dan KEDUANYA terkirim.
 *
 * Fix: mutex per-key berbasis promise — `onFire` untuk key yang sama tidak
 * pernah berjalan bersamaan; batch baru menunggu batch lama selesai.
 */
const { debounceMessage } = require('../utils/responseDebounce');

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('\n── onFire untuk key yang SAMA tidak pernah berjalan bersamaan ──');
  {
    const KEY = 'test_concurrency_key_1';
    let concurrentCount = 0;
    let maxConcurrent = 0;
    const callOrder = [];
    const fireLog = [];

    const slowOnFire = async (combined) => {
      concurrentCount++;
      maxConcurrent = Math.max(maxConcurrent, concurrentCount);
      callOrder.push('start:' + combined);
      await sleep(150);   // simulasikan panggilan AI provider yang lambat
      fireLog.push(combined);
      callOrder.push('end:' + combined);
      concurrentCount--;
    };

    // Batch pertama: dua pesan digabung, timer pendek untuk mempercepat tes.
    process.env.AI_COOKIE_RESPONSE_TIMER = '30';
    delete require.cache[require.resolve('../utils/responseDebounce')];
    const { debounceMessage: fastDebounce } = require('../utils/responseDebounce');

    fastDebounce(KEY, 'pesan A1', slowOnFire);
    fastDebounce(KEY, 'pesan A2', slowOnFire);
    await sleep(60);   // biarkan timer batch pertama menembak (30ms) — onFire mulai (butuh 150ms)

    // Batch KEDUA tiba SAAT onFire pertama MASIH berjalan (baru lewat 60ms dari 150ms).
    fastDebounce(KEY, 'pesan B1', slowOnFire);
    // Batch kedua BARU MULAI setelah batch pertama selesai (~180ms) lalu masih
    // butuh 150ms sendiri → total ±330ms dari awal. Beri margin generous.
    await sleep(500);

    ok('maksimal 1 onFire berjalan bersamaan (tidak pernah 2)', maxConcurrent === 1);
    ok('batch pertama (A1\\nA2) selesai SEBELUM batch kedua (B1) mulai',
       callOrder.indexOf('end:pesan A1\npesan A2') < callOrder.indexOf('start:pesan B1'));
    ok('kedua batch tetap terpanggil (tidak ada yang hilang)', fireLog.length === 2);
  }

  console.log('\n── Key BERBEDA tetap boleh berjalan bersamaan (tidak over-serialize) ──');
  {
    process.env.AI_COOKIE_RESPONSE_TIMER = '20';
    delete require.cache[require.resolve('../utils/responseDebounce')];
    const { debounceMessage: fastDebounce } = require('../utils/responseDebounce');

    let concurrentCount = 0;
    let maxConcurrent = 0;
    const onFire = async () => {
      concurrentCount++;
      maxConcurrent = Math.max(maxConcurrent, concurrentCount);
      await sleep(100);
      concurrentCount--;
    };

    fastDebounce('customer_X', 'halo dari X', onFire);
    fastDebounce('customer_Y', 'halo dari Y', onFire);
    await sleep(200);

    ok('2 customer BERBEDA boleh diproses bersamaan', maxConcurrent === 2);
  }

  console.log(`\nRESULT: ${pass}/${total}`);
  process.exit(pass === total ? 0 : 1);
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
