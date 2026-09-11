/**
 * M188 (11 Sep 2026) — FAKTA BACKEND YANG SALAH = MODEL DIBOHONGI.
 *
 * Ditemukan lewat simulasi live (scripts/simulate-platform-skill.js chatgpt,
 * 8 sesi × 10-13 giliran, DeepSeek × chat_gpt_responds). Di profil 'platform'
 * backend tidak lagi menyusun balasan, jadi SATU-SATUNYA cara backend merusak
 * percakapan adalah mengirim fakta yang salah. Setiap kasus di bawah pernah
 * muncul di summary customer sungguhan.
 */
require('dotenv').config();
const p = require('../services/aiPromptBuilderService');
const prs = require('../services/propertyRecommendationService');
const { parseCustomerDate } = require('../utils/customerDateParser');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ` — ${extra}` : ''}`); }
};
const C = (m) => ({ role: 'customer', message: m });
const A = (m) => ({ role: 'ai', message: m });

async function main() {
  await prs.initCityCache(); await prs.initLandmarkCache(); await prs.initFacilityCache();

  console.log('\n[1] Investor yang MENYEWAKAN adalah pembeli (tx=sale)');
  {
    const m = 'Saya cari rumah untuk investasi disewakan, area Mulyorejo Surabaya.';
    ok('extractQualificationState → sale', p.extractQualificationState([], m).transactionType === 'sale');
    ok('extractPropertyFilters → sale', prs.extractPropertyFilters(m, []).transactionType === 'sale');
    ok('penyewa asli tetap rent', prs.extractPropertyFilters('cari rumah yang disewakan di surabaya', []).transactionType === 'rent');
  }

  console.log('\n[2] "putuskan sendiri / konsul keluarga" = keputusan, bukan penghuni');
  {
    const st = p.extractQualificationState([C('beli rumah mulyorejo'), A('ok')], 'Saya putuskan sendiri, nggak perlu konsul keluarga.');
    ok('decisionMaker = Mandiri', st.decisionMaker === 'Mandiri', st.decisionMaker);
    ok('household kosong', !st.household, st.household);
    ok('"tinggal sendiri" masih penghuni 1 orang', /1 orang/.test(p.extractQualificationState([C('sewa rumah'), A('sama siapa?')], 'saya tinggal sendiri aja').household || ''));
  }

  console.log('\n[3] Pertanyaan harga bukan budget');
  {
    ok('"yang paling murah berapa?" → budget kosong', !p.extractQualificationState([C('beli rumah'), A('ok')], 'Yang paling murah berapa?').budget);
    ok('"yang murah aja kak" → terjangkau', p.extractQualificationState([C('beli rumah'), A('budget?')], 'yang murah aja kak').budget === 'terjangkau');
  }

  console.log('\n[4] Negasi pembiayaan');
  {
    const f = (m) => p.extractQualificationState([C('beli rumah candramas'), A('ok')], m).financing;
    ok('"nggak mau bahas KPR dulu" → kosong', f('Saya nggak mau bahas KPR dulu ya.') == null);
    ok('"cash, nggak pakai KPR" → cash', f('Bayarnya cash ya, nggak pakai KPR.') === 'cash');
    ok('"pakai KPR BCA" → KPR', f('Saya pakai KPR BCA') === 'KPR');
    ok('"KPR dan sebagian cash" → kombinasi', /kombinasi/.test(f('Rencana KPR dan sebagian cash') || ''));
  }

  console.log('\n[5] Ukuran tanah bukan tipe properti');
  {
    const h = [C('Mau beli rumah di Sidoarjo'), A('area?'), C('Tropodo'), A('ini 2'), C('tanahnya kecil'), A('ok')];
    const st = p.extractQualificationState(h, 'Saya butuh tanah minimal 120 m2.');
    ok('tipe tetap house', st.buildingType === 'house', st.buildingType);
    ok('tidak ada banner ganti tipe', !st.typeChangedFromHistory);
    ok('"cari tanah kavling" tetap others', p.extractQualificationState([], 'cari tanah kavling di Gresik').buildingType === 'others');
    ok('detectBuildingType("tanah minimal 120 m2") kosong', prs.detectBuildingType('Saya butuh tanah minimal 120 m2') === '');
  }

  console.log('\n[6] Nama hari & tanggal survei sukarela');
  {
    const sat = parseCustomerDate('hari Sabtu ini jam 10 pagi');
    ok('"Sabtu ini" terparse', sat && sat.status === 'ok' && sat.date.getDay() === 6, JSON.stringify(sat && sat.formatted));
    const tue = parseCustomerDate('Selasa depan jam 4 sore');
    ok('"Selasa depan" = Selasa ≥ 7 hari lagi', tue && tue.date.getDay() === 2 && (tue.date - new Date()) > 6 * 864e5);
    ok('"2 minggu" bukan hari Minggu', parseCustomerDate('selama 2 Minggu') === null);
    ok('"minggu ini" bukan hari Minggu', parseCustomerDate('minggu ini') === null);
    ok('"hari minggu" = hari Minggu', (parseCustomerDate('hari minggu') || {}).date?.getDay() === 0);
    const h = [C('sewa rumah sidoarjo'), A('ini 2'), C('Saya pilih yang nomor 2.'), A('Suko House Rent.')];
    const st = p.extractQualificationState(h, 'Saya mau survei hari Sabtu ini jam 10 pagi.');
    ok('viewingDate terisi tanpa AI bertanya', !!st.viewingDate && st.viewingDate !== 'Minta listing', st.viewingDate);
    ok('viewingTime terisi', /10/.test(st.viewingTime || ''));
    ok('moveInDate TIDAK terisi dari kalimat survei', !st.moveInDate, st.moveInDate);
    const st2 = p.extractQualificationState([...h, C('Saya mau survei hari Sabtu ini jam 10 pagi.'), A('ok')], 'Masuknya rencana awal Desember.');
    ok('tanggal masuk terpisah dari survei', /Desember/.test(st2.moveInDate || '') && !/Desember/.test(st2.viewingDate || ''));
    const st3 = p.extractQualificationState([C('sewa apartemen kalijudan'), A('Mau saya jadwalkan survei? Tanggal berapa?')], 'Untuk 1 tahun, mulai November.');
    ok('"mulai November" = masuk, bukan survei', /November/.test(st3.moveInDate || '') && !st3.viewingDate, `view=${st3.viewingDate}`);
  }

  console.log('\n[7] Kota pindah lewat bentuk tanya; area menang atas tag landmark');
  {
    const h = [{ role: 'user', message: 'Mau beli rumah di Malang, ada?' }, { role: 'ai', message: 'Maaf, Malang belum ada stok.' }];
    ok('"Kalau Sidoarjo ada apa saja?" → Sidoarjo', prs.extractPropertyFilters('Yah. Kalau Sidoarjo ada apa saja?', h).location === 'Sidoarjo');
    ok('kota asal di small talk tidak menimpa', prs.extractPropertyFilters('Saya asalnya dari Surabaya sih', [{ role: 'user', message: 'cari rumah di Sidoarjo' }]).location === 'Sidoarjo');
    const c = await prs.buildRecommendationContextForLLM('Saya rencana beli rumah, Kak', [{ role: 'user', message: 'Saya cari rumah di Pakuwon, Kak' }, { role: 'ai', message: 'beli atau sewa?' }], { userId: process.env.TEST_AGENT_USER_ID || 'NA40D8N007' });
    const titles = c.exactMatches.slice(0, 3).map((x) => x.title || '').join(' | ');
    ok('katalog "rumah di Pakuwon" = area Pakuwon, bukan unit ber-tag landmark', /Pakuwon/i.test(titles), titles);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
