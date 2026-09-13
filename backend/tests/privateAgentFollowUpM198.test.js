/**
 * M198 (13 Sep 2026) — Private Agent: percakapan tetap hidup sesudah summary,
 * pertanyaan customer dijawab dulu, dan slot tidak terisi kalimat yang bukan jawaban.
 * Temuan simulasi 10 sesi Private Agent (logs/sim-private-2026-09-13.md).
 * Semua deterministik — tidak ada panggilan LLM maupun DB kecuali disebut.
 */
require('dotenv').config();
process.env.AI_PRIMARY_PROVIDER = 'private';
let pass = 0, fail = 0;
const ok = (l, c, e = '') => { if (c) { pass++; console.log(`  ✅ ${l}`); } else { fail++; console.log(`  ❌ ${l}${e ? ' — ' + e : ''}`); } };
const A = (m) => ({ role: 'ai', message: m }); const C = (m) => ({ role: 'customer', message: m });

const g = require('../utils/customerQuestionGuard');
const { parseCustomerDate } = require('../utils/customerDateParser');
const { customerAsksAvailability } = require('../utils/areaAvailabilityGate');
const { detectBudget, detectLocation } = require('../services/propertyRecommendationService');
const pb = require('../services/aiPromptBuilderService');
const lsg = require('../utils/listingSelectionGate');

console.log('\n[1] Sinyal penutup vs menjelajah vs bertanya');
ok('"tanya-tanya dulu" BUKAN penutup', g.customerSignalsClosing('Saya masih tanya-tanya dulu ya, belum mau survei.') === false);
ok('"tanya-tanya dulu" = menjelajah', g.customerIsBrowsing('Saya masih tanya-tanya dulu ya') === true);
ok('"Nggak cocok, kejauhan" BUKAN penutup', g.customerSignalsClosing('Nggak cocok, kejauhan dari kerja saya di Waru.') === false);
ok('"Yah nggak ada ya. Kalau yang dekat Buduran?" BUKAN penutup (masih bertanya)', g.customerSignalsClosing('Yah nggak ada ya. Kalau yang dekat Buduran?') === false);
ok('"Cukup segitu dulu" = penutup', g.customerSignalsClosing('Cukup segitu dulu, nanti saya kabari.') === true);
ok('"Oke itu saja dulu, terima kasih" = penutup', g.customerSignalsClosing('Oke itu saja dulu, terima kasih infonya.') === true);

console.log('\n[2] Survei: penolakan vs permintaan');
ok('"belum mau survei" = menolak', g.customerDeclinesViewing('belum mau survei') && !g.customerRequestsViewing('Saya masih tanya-tanya dulu ya, belum mau survei.'));
ok('"Nggak mau survei dulu, lihat-lihat saja" = menolak', !g.customerRequestsViewing('Nggak mau survei dulu, lihat-lihat saja.'));
ok('"Bisa lihat langsung unitnya Sabtu depan jam 10?" = minta survei', g.customerRequestsViewing('Bisa lihat langsung unitnya Sabtu depan jam 10?'));
ok('"Ayo ketemuan Sabtu depan" = minta survei', g.customerRequestsViewing('Ayo ketemuan Sabtu depan jam 10 pagi.'));
ok('"Belum tau, tapi mau survei dulu" = minta survei', g.customerRequestsViewing('Belum tau, tapi mau survei dulu'));

console.log('\n[3] Tanggal: nama hari + pekan depan, kualifikasi tahun depan');
const now = new Date(2026, 8, 13); // Minggu 13 Sep 2026
ok('"minggu depan Rabu" → Rabu 23 Sep', parseCustomerDate('minggu depan rabu jam 2 siang', now).formatted === '23 September 2026', parseCustomerDate('minggu depan rabu jam 2 siang', now).formatted);
ok('"Rabu depan" → 23 Sep', parseCustomerDate('rabu depan', now).formatted === '23 September 2026');
ok('"minggu depan" polos → +7 hari', parseCustomerDate('minggu depan', now).formatted === '20 September 2026');
ok('"awal tahun depan" → 01 Januari 2027', parseCustomerDate('Masuknya awal tahun depan.', now).formatted === '01 Januari 2027');
ok('"akhir tahun depan" → 01 Desember 2027', parseCustomerDate('akhir tahun depan', now).formatted === '01 Desember 2027');

console.log('\n[4] Tawaran survei dijawab dengan tanggal di pesan yang sama');
const offer = [A('Baik, Kak 😊 Dicatat pilihannya: *X* (351.7 juta).\n\nMau saya jadwalkan survei ke unit ini?')];
const v1 = lsg.tryPendingViewingConfirmation({ message: 'Survei Sabtu depan jam 10 bisa?', history: offer, isId: true });
ok('tanggal+jam → viewing-scheduled', v1 && v1.verdict === 'viewing-scheduled', v1 && v1.verdict);
const v2 = lsg.tryPendingViewingConfirmation({ message: 'Minggu depan Rabu jam 2 siang', history: offer, isId: true });
ok('jadwal tanpa kata "mau" tetap = setuju + terjadwal', v2 && v2.verdict === 'viewing-scheduled', v2 && v2.verdict);
const v3 = lsg.tryPendingViewingConfirmation({ message: 'Mau', history: offer, isId: true });
ok('"Mau" polos → tanya tanggal', v3 && v3.verdict === 'viewing-confirmed');

console.log('\n[5] Permintaan ketersediaan yang dulu lolos');
for (const m of ['Kok mahal. Ada yang di bawah 400 juta?', 'Yang dekat Waru ada? Tropodo mungkin.', 'Ada apartemen sewa bulanan di Surabaya dekat kampus ITS?', 'Yah nggak ada ya. Kalau yang dekat Buduran?', 'Alana Cemandi boleh, lihat 2 pilihan.']) {
  ok(`asks: "${m}"`, customerAsksAvailability(m) === true);
}
for (const m of ['Budget saya maksimal 450 juta.', 'Yang tidak dekat jalan raya ya, berisik.', 'Kalau nggak ada ya sudah, jangan dipaksa.', 'Kalau nego bisa berapa?']) {
  ok(`bukan asks: "${m}"`, customerAsksAvailability(m) === false);
}

console.log('\n[6] Ekstraktor: slot tidak terisi kalimat yang bukan jawaban');
ok('"tanah minimal 120 m2" bukan budget', detectBudget('Saya butuh tanah minimal 120 m2.') === null);
ok('"lokasinya di maps" bukan kota', !detectLocation('Boleh dikirim lokasinya di maps?'));
const stA = pb.extractQualificationState([C('Sewa apartemen Kalijudan Surabaya'), A('Ada lokasi atau tempat tertentu yang jadi patokan?')], 'Cukup segitu dulu, nanti saya kabari.');
ok('penutup tidak masuk slot patokan', !stA.anchorPoint, JSON.stringify(stA.anchorPoint));
const stB = pb.extractQualificationState([C('Beli rumah Sidoarjo Alana Cemandi'), A('Ada fasilitas tertentu?')], 'Yang tidak dekat jalan raya ya, berisik.');
ok('"tidak dekat jalan raya" bukan patokan', !stB.anchorPoint, JSON.stringify(stB.anchorPoint));
const stC = pb.extractQualificationState([C('Beli rumah Sidoarjo Tropodo'), A('Dicatat pilihannya: *X*.')], 'Dekat sekolah nggak?');
ok('"Dekat sekolah nggak?" bukan patokan', !stC.anchorPoint, JSON.stringify(stC.anchorPoint));
const stD = pb.extractQualificationState([C('Beli rumah Sidoarjo Candramas'), A('ini 2 unit')], 'Saya nggak mau bahas KPR dulu ya.');
ok('"nggak mau bahas KPR" → financingRefused, bukan red flag', stD.financingRefused === true && !stD.redFlags, JSON.stringify(stD.redFlags));
const stE = pb.extractQualificationState([C('Sewa apartemen Surabaya dekat ITS'), A('belum ada di Sukolilo')], 'Selain Sukolilo jangan ya, saya maunya dekat ITS saja.');
ok('"selain Sukolilo jangan, maunya dekat ITS" bukan red flag', !stE.redFlags, JSON.stringify(stE.redFlags));
const stF = pb.extractQualificationState([C('Mau beli rumah di Malang, ada?'), A('belum ada'), C('Kalau Sidoarjo?'), A('Di area mana? Contoh: Candramas, Alana Cemandi')], 'Alana Cemandi boleh, lihat 2 pilihan.');
ok('area = "Alana Cemandi" (klausa permintaan dibuang)', stF.district === 'Alana Cemandi', JSON.stringify(stF.district));

console.log('\n[7] Hitungan giliran sejak perubahan (Gate C)');
const turns = pb.countCustomerTurns([C('beli rumah sidoarjo'), A('x'), C('candramas'), A('y'), C('ganti ke gresik'), A('z')], 'yang 3 kamar?', {});
ok('4 pesan total, 2 sejak ganti kota', turns.customerTurns === 4 && turns.turnsSinceChange === 2, JSON.stringify(turns));

console.log('\n[8] Pertanyaan atribut vs pernyataan');
ok('"Yang tidak dekat jalan raya ya, berisik." bukan pertanyaan atribut', lsg.isAttributeQuestion('Yang tidak dekat jalan raya ya, berisik.') === false);
ok('"Rumahnya banjir nggak kalau hujan?" = pertanyaan atribut', lsg.isAttributeQuestion('Rumahnya banjir nggak kalau hujan?') === true);
ok('"Sudah termasuk IPL belum?" = pertanyaan atribut', lsg.isAttributeQuestion('Sudah termasuk IPL belum?') === true);

console.log(`\nRESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
process.exit(fail ? 1 : 0);
