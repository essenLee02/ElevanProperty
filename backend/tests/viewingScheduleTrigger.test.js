/**
 * viewingScheduleTrigger.test.js — Google Calendar viewing-schedule auto-trigger.
 *
 * Covers:
 *   - ConversationQualifier.extractConcreteViewingDateTime() — only fires on a
 *     GENUINE, bookable date+time (real calendar date + specific hour), never on
 *     vague states ("mau viewing", "besok" without an hour, needs-coordination).
 *   - Casual Indonesian time-of-day disambiguation (siang/sore/malam → 24h).
 *   - viewingScheduleTrigger's dedup marker (role:'system', invisible to the
 *     aiText/custText scanners used everywhere else in the qualification flow).
 *
 * Run: node tests/viewingScheduleTrigger.test.js
 */

'use strict';

const { ConversationQualifier: CQ } = require('../controllers/chatbotPrivateController');
const { alreadyScheduledFor, maybeScheduleViewingFromChat } = require('../services/viewingScheduleTrigger');

let pass = 0, fail = 0;
function ok(label, cond) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}`); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('── extractConcreteViewingDateTime: only fires on a genuine bookable slot ──');
{
  const cases = [
    ['concrete date + siang hour', { hasViewingHour: true, viewingDayRef: '9 Juli 2026', viewingTimeOfDay: 'siang', _custText: 'jam 2 siang' }, { dateString: '2026-07-09', timeString: '14:00' }],
    ['concrete date + malam hour', { hasViewingHour: true, viewingDayRef: '9 Juli 2026', viewingTimeOfDay: 'malam', _custText: 'jam 8 malam' }, { dateString: '2026-07-09', timeString: '20:00' }],
    ['concrete date + pagi hour (no shift)', { hasViewingHour: true, viewingDayRef: '9 Juli 2026', viewingTimeOfDay: 'pagi', _custText: 'jam 7 pagi' }, { dateString: '2026-07-09', timeString: '07:00' }],
    ['jam 11 siang stays AM (ambiguous-hour guard)', { hasViewingHour: true, viewingDayRef: '9 Juli 2026', viewingTimeOfDay: 'siang', _custText: 'jam 11 siang' }, { dateString: '2026-07-09', timeString: '11:00' }],
    ['explicit HH:MM', { hasViewingHour: true, viewingDayRef: '9 Juli 2026', viewingTimeOfDay: '', _custText: 'jam 14:30' }, { dateString: '2026-07-09', timeString: '14:30' }],
    ['correction wins: jam 11 then ralat jam 2', { hasViewingHour: true, viewingDayRef: '9 Juli 2026', viewingTimeOfDay: 'siang', _viewingText: 'jam 11, ralat jam 2 aja' }, { dateString: '2026-07-09', timeString: '14:00' }],
    ['vague: relative dayRef ("besok") never bookable', { hasViewingHour: true, viewingDayRef: 'besok', viewingTimeOfDay: 'siang', _custText: 'jam 1' }, null],
    ['vague: no hour at all', { hasViewingHour: false, viewingDayRef: '9 Juli 2026' }, null],
    ['vague: wants viewing but no date/hour yet', { hasViewingHour: false, wantsViewingScheduled: true }, null],
  ];
  for (const [label, profile, expected] of cases) {
    ok(label, eq(CQ.extractConcreteViewingDateTime(profile), expected));
  }
}

console.log('\n── Dedup marker: role:"system" is invisible to aiText/custText scanners ──');
{
  const history = [
    { role: 'user', message: 'mau sewa rumah di surabaya' },
    { role: 'system', message: '[SYSTEM] CALENDAR_EVENT_CREATED|2026-07-09|14:00 — budget terjangkau menengah eksklusif tanggal masuk' },
  ];
  const filters = { buildingType: 'house', transactionType: 'rent', location: 'Surabaya' };
  const p = CQ.buildProfile(history, 'budget menengah aja', filters);
  ok('system-role message does NOT count as aiAskedBudget despite matching words', p.aiAskedBudget === false);
}

console.log('\n── alreadyScheduledFor: dedup by exact date+time, not just presence ──');
{
  const history = [
    { role: 'system', message: '[SYSTEM] CALENDAR_EVENT_CREATED|2026-07-09|14:00 — Jadwal viewing tersimpan.' },
  ];
  ok('same date+time → already scheduled', alreadyScheduledFor(history, '2026-07-09', '14:00') === true);
  ok('different time, same date → NOT yet scheduled (reschedule allowed)', alreadyScheduledFor(history, '2026-07-09', '16:00') === false);
  ok('no marker at all → not scheduled', alreadyScheduledFor([{ role: 'user', message: 'hi' }], '2026-07-09', '14:00') === false);
}

console.log('\n── maybeScheduleViewingFromChat: fails closed and cleanly on missing inputs ──');
{
  const noSession = { currentMessage: 'jam 2 siang', agentUserId: 'X', agentEmail: 'a@b.com' };
  const noAgentEmail = { currentMessage: 'jam 2 siang', sessionId: 1, agentUserId: 'X' };
  Promise.all([
    maybeScheduleViewingFromChat(noSession).then(r => ok('missing sessionId → NO_SESSION_ID, no throw', r.scheduled === false && r.reason === 'NO_SESSION_ID')),
    maybeScheduleViewingFromChat(noAgentEmail).then(r => ok('missing agentEmail → NO_AGENT_EMAIL, no throw', r.scheduled === false && r.reason === 'NO_AGENT_EMAIL')),
  ]).then(() => {
    console.log(`\nRESULT: ${pass}/${pass + fail} passed ${fail ? '❌ FAILURES' : '✅'}`);
    process.exit(fail ? 1 : 0);
  });
}
