import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, makeApp, viewerIp } from '../app.mjs';
import { memoryStore } from './memory-store.mjs';

const SECRET = 'test-secret';

function setup() {
  const store = memoryStore();
  let clock = Date.UTC(2026, 9, 1, 12);
  const app = makeApp({ store, secret: SECRET, now: () => clock });
  const call = async (method, path, body, { ip = '203.0.113.7:4444', secret = SECRET, query } = {}) => {
    const res = await app({
      requestContext: { http: { method } }, rawPath: path, queryStringParameters: query,
      headers: { 'x-origin-verify': secret, 'cloudfront-viewer-address': ip },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    return { status: res.statusCode, body: JSON.parse(res.body), headers: res.headers };
  };
  const play = async (seconds, easy = false, opts) => {
    const r = await call('POST', '/api/session', { easy }, opts);
    clock += seconds * 1000;
    return r.body.session;
  };
  return { store, call, play, tick: s => { clock += s * 1000; } };
}

test('a game can save one score and see its rank', async () => {
  const { call, play } = setup();
  const session = await play(120);
  const r = await call('POST', '/api/scores', { session, name: 'Ella', score: 4200, level: 2, done: false });
  assert.equal(r.status, 201);
  assert.equal(r.body.rank, 1);
  assert.equal(r.body.board, 'normal');
  assert.deepEqual(r.body.top, [{ id: r.body.id, name: 'Ella', score: 4200, level: 2, done: false }]);

  const list = await call('GET', '/api/scores', undefined, { query: { board: 'normal' } });
  assert.equal(list.status, 200);
  assert.equal(list.body.top.length, 1);
  assert.match(list.headers['cache-control'], /max-age=5/);
});

test('sending the same score again is answered the same way, and only saved once', async () => {
  const { call, play, store } = setup();
  const session = await play(120);
  const score = { session, name: 'Ella', score: 4200, level: 2, done: false };
  const first = await call('POST', '/api/scores', score);
  const again = await call('POST', '/api/scores', score);
  assert.equal(again.status, 200);
  assert.equal(again.body.id, first.body.id);
  assert.equal([...store.items.keys()].filter(k => k.startsWith('H#')).length, 1);
  const changed = await call('POST', '/api/scores', { ...score, score: 9000 });
  assert.equal(changed.status, 409);
});

test('easy games go on the easy board', async () => {
  const { call, play } = setup();
  const session = await play(120, true);
  const r = await call('POST', '/api/scores', { session, name: 'Ella', score: 3000, level: 2, done: false });
  assert.equal(r.body.board, 'easy');
  assert.equal((await call('GET', '/api/scores', undefined, { query: { board: 'normal' } })).body.top.length, 0);
  assert.equal((await call('GET', '/api/scores', undefined, { query: { board: 'easy' } })).body.top.length, 1);
});

test('ranks count only the same board', async () => {
  const { call, play } = setup();
  for (const [score, easy] of [[9000, false], [8000, true], [7000, false]]) {
    const session = await play(300, easy);
    await call('POST', '/api/scores', { session, name: 'P' + score, score, level: 3, done: false });
  }
  const session = await play(300);
  const r = await call('POST', '/api/scores', { session, name: 'Me', score: 7500, level: 3, done: false });
  assert.equal(r.body.rank, 2);
  assert.deepEqual(r.body.top.map(e => e.score), [9000, 7500, 7000]);
});

test('unknown games, bad names and impossible scores are refused', async () => {
  const { call, play } = setup();
  assert.equal((await call('POST', '/api/scores', { session: 'A'.repeat(22), name: 'Ella', score: 10, level: 1, done: false })).status, 410);
  assert.equal((await call('POST', '/api/scores', { session: 'short', name: 'Ella', score: 10, level: 1, done: false })).status, 400);
  const session = await play(5);
  const name = await call('POST', '/api/scores', { session, name: 'sh1t', score: 10, level: 1, done: false });
  assert.deepEqual([name.status, name.body.error], [400, 'name']);
  const fast = await call('POST', '/api/scores', { session, name: 'Ella', score: 4000, level: 8, done: false });
  assert.deepEqual([fast.status, fast.body.error], [422, 'refused']);
});

test('requests that skip CloudFront get nothing', async () => {
  const { call } = setup();
  assert.equal((await call('GET', '/api/scores', undefined, { secret: 'wrong' })).status, 404);
  assert.equal((await call('GET', '/api/scores', undefined, { secret: '' })).status, 404);
});

test('broken requests are refused politely, never with 403', async () => {
  const { call } = setup();
  assert.equal((await call('POST', '/api/scores', 'not json')).status, 400);
  assert.equal((await call('POST', '/api/scores', '[1,2]')).status, 400);
  assert.equal((await call('POST', '/api/scores', JSON.stringify({ pad: 'x'.repeat(3000) }))).status, 413);
  assert.equal((await call('GET', '/api/scores', undefined, { query: { board: 'hard' } })).status, 400);
  assert.equal((await call('DELETE', '/api/scores')).status, 404);
});

test('each player can only start so many games an hour', async () => {
  const { call, tick } = setup();
  for (let i = 0; i < LIMITS.session.perHour; i++) assert.equal((await call('POST', '/api/session', {})).status, 201);
  assert.equal((await call('POST', '/api/session', {})).status, 429);
  assert.equal((await call('POST', '/api/session', {}, { ip: '198.51.100.2:1' })).status, 201, 'another player is not affected');
  tick(3600);
  assert.equal((await call('POST', '/api/session', {})).status, 201, 'the limit resets the next hour');
});

test("the visitor's address is read from CloudFront's header", () => {
  assert.equal(viewerIp({ 'cloudfront-viewer-address': '203.0.113.7:4444' }), '203.0.113.7');
  assert.equal(viewerIp({ 'cloudfront-viewer-address': '2001:db8::1:4444' }), '2001:db8::1');
  assert.equal(viewerIp({ 'cloudfront-viewer-address': '[2001:db8::1]:4444' }), '2001:db8::1');
  assert.equal(viewerIp({}), 'unknown');
});
