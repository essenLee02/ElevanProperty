/**
 * VIEWING_SCHEDULE_INTEGRATION_EXAMPLE.js
 *
 * Contoh cara integrate Google Calendar viewing schedule ke dalam
 * Private Agent (chatbotPrivateController.js) untuk auto-schedule viewing
 * ketika customer mention tanggal/jam di akhir Q-flow.
 *
 * BELUM di-implementasi di codebase — ini template untuk future integration.
 */

// ─── Pseudo-code Integration ───────────────────────────────────────────────

// Di chatbotPrivateController.js, bagian akhir sebelum return summary:

async function generatePrivateTerminalMassege(options = {}) {
  // ... (existing code) ...

  // Setelah Q1-Q12 selesai, sebelum return final summary/brief:

  // ── STEP 1: Detect viewing request dari pesan customer ──
  const { detectViewingDateTime } = require('../services/googleCalendarService');
  const viewingDateTime = detectViewingDateTime(userMessage);

  if (viewingDateTime) {
    console.log('[PrivateAgent/ViewingSchedule] Viewing request detected:', viewingDateTime);

    // ── STEP 2: Prepare schedule payload ──
    const schedulePayload = {
      agentUserId: scopedUserId,              // Dari session (agen yang punya property)
      customerName: profile.customerName || 'Customer',
      customerEmail: session?.email,          // Dari user/session jika ada
      propertyId: filters.propertyId,         // Opsional
      propertyAddress: filters.location || 'TBD',
      propertyType: PropertyFormatter.humanBuildingType(filters.buildingType, lang),
      transactionType: filters.transactionType || 'rent',
      dateString: viewingDateTime.dateString,
      timeString: viewingDateTime.timeString,
    };

    // ── STEP 3: Call scheduling endpoint ──
    try {
      const axios = require('axios');
      const baseURL = process.env.API_BASE_URL || 'http://localhost:5000';

      const scheduleResult = await axios.post(
        `${baseURL}/api/viewing/schedule`,
        schedulePayload,
        { timeout: 10000 }  // 10 sec timeout
      );

      if (scheduleResult.data.success) {
        console.log('[PrivateAgent/ViewingSchedule] ✅ Event created:', scheduleResult.data.eventId);

        // ── STEP 4: Append confirmation ke final reply ──
        const confirmation = lang === 'id'
          ? `✅ Jadwal viewing telah dibuat di Google Calendar.\n📅 ${scheduleResult.data.startDateTime}\n🔗 ${scheduleResult.data.eventLink}\n`
          : `✅ Viewing appointment scheduled in Google Calendar.\n📅 ${scheduleResult.data.startDateTime}\n🔗 ${scheduleResult.data.eventLink}\n`;

        // Prepend ke summary/brief
        const briefText = builder.agentBrief(brief);
        const reply = confirmation + '\n' + briefText;

        return this.#wrap(reply, {
          skillInfo,
          filters,
          responseMode: 'summary',
          viewingScheduled: true,
          viewingEventId: scheduleResult.data.eventId,
        });
      }
    } catch (scheduleErr) {
      console.warn('[PrivateAgent/ViewingSchedule] Schedule failed:', scheduleErr.message);
      // Non-fatal — continue dengan summary normal tanpa calendar event
    }
  }

  // ── STEP 5: Kalau bukan viewing request / schedule failed → return summary biasa ──
  const brief = ConversationQualifier.buildAgentBrief(profile, filters, history, userMessage);
  const reply = builder.agentBrief(brief);

  return this.#wrap(reply, {
    skillInfo,
    filters,
    responseMode: 'summary',
  });
}

// ─── Test Script ───────────────────────────────────────────────────────────

// Simulate customer message dengan viewing request
const testCases = [
  {
    message: "saya mau viewing villa ini tanggal 19 juli jam 2 siang",
    expected: {
      hasViewing: true,
      dateString: "2026-07-19",
      timeString: "14:00",
    }
  },
  {
    message: "bisa saya lihat unitnya 2026-07-20 jam 10:00?",
    expected: {
      hasViewing: true,
      dateString: "2026-07-20",
      timeString: "10:00",
    }
  },
  {
    message: "saya tertarik dengan harganya, punya unit lain?",
    expected: {
      hasViewing: false,
    }
  },
];

// Test detection
const { detectViewingDateTime } = require('./services/googleCalendarService');

console.log('\n=== Testing Viewing DateTime Detection ===\n');
for (const test of testCases) {
  const result = detectViewingDateTime(test.message);
  console.log(`Message: "${test.message}"`);
  console.log(`Result: ${JSON.stringify(result)}`);
  console.log(`Expected: ${JSON.stringify(test.expected)}`);
  console.log(`Match: ${JSON.stringify(result) === JSON.stringify(test.expected)}\n`);
}

// Test API call (manual — uncomment untuk test real API)
/*
const axios = require('axios');

(async () => {
  try {
    console.log('\n=== Testing Schedule Viewing API ===\n');
    const response = await axios.post('http://localhost:5000/api/viewing/schedule', {
      agentUserId: 'LFGKT49002',
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
      propertyAddress: 'Jl. Merdeka No. 42, Surabaya',
      propertyType: 'villa',
      transactionType: 'rent',
      dateString: '2026-07-19',
      timeString: '14:00',
    });

    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
})();
*/

// ─── Multi-Agent Considerations ────────────────────────────────────────────

/**
 * Fitur ini sudah designed untuk multi-agent:
 *
 * 1. Setiap agent (user_id di database) punya email tersendiri di users.email
 * 2. scopedUserId di session menentukan agen mana yang punya property
 * 3. Google Calendar invite dikirim ke email agen tersebut
 * 4. Event attendees = agen + customer (kalau ada email customer)
 *
 * Jadi ketika system mempunyai 5+ agents dengan properties tersendiri,
 * setiap agent akan dapat Google Calendar event di calendar mereka sendiri
 * (based on email dari users.email per user_id).
 */

module.exports = {
  // Placeholder — actual integration di chatbotPrivateController.js
};
