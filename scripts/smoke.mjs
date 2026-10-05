// Runs after each deploy against the live site: the game page loads and the Top 10 API answers.
// Read-only apart from one request the API must refuse, so no test scores reach the Top 10.
// Usage: node scripts/smoke.mjs https://example.cloudfront.net
const site = (process.argv[2] || '').replace(/\/$/, '');
if (!site) { console.error('usage: node scripts/smoke.mjs <site url>'); process.exit(2); }

const checks = [
  ['game page loads', async () => {
    const r = await fetch(site + '/');
    return r.status === 200 && (await r.text()).includes('id="game"');
  }],
  ...['normal', 'easy'].map(board => [`${board} Top 10 loads`, async () => {
    const r = await fetch(`${site}/api/scores?board=${board}`);
    const body = await r.json();
    return r.status === 200 && body.board === board && Array.isArray(body.top);
  }]),
  ['API checks what it is sent', async () => {
    const r = await fetch(site + '/api/scores', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    return r.status === 400 && (await r.json()).error === 'invalid';
  }],
];

let failed = 0;
for (const [name, check] of checks) {
  let ok = false;
  for (let attempt = 1; attempt <= 5 && !ok; attempt++) { // a fresh deploy can take a moment to settle
    try { ok = await check(); } catch { ok = false; }
    if (!ok && attempt < 5) await new Promise(r => setTimeout(r, attempt * 3000));
  }
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failed++;
}
process.exit(failed ? 1 : 0);
