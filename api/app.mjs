// The Top 10 API. CloudFront sends /api/* here through API Gateway.
//
//   POST /api/session  {easy}                          -> {session}        a game starts
//   POST /api/scores   {session, name, score, level, done} -> {id, rank, board, top}
//   GET  /api/scores?board=normal|easy                 -> {board, top}
//
// Storage is passed in (see store-dynamodb.mjs), so tests can run against an in-memory store.
// Never answer 403: CloudFront turns 403s into the game page (see infra/site.yaml).
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { BOARDS, cleanName, nameProblem, scoreProblem } from './rules.mjs';

export const LIMITS = {
  session: { perHour: 60 }, // games started per player per hour
  score: { perHour: 20 }, // scores sent per player per hour
};
export const SESSION_TTL_HOURS = 24;
export const TOP_N = 10;
const MAX_BODY = 2048;
const SESSION_ID = /^[A-Za-z0-9_-]{22}$/;

const json = (statusCode, body, cache = 'no-store') => ({
  statusCode,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache },
  body: JSON.stringify(body),
});

// One JSON line per event. Counted events are also CloudWatch metrics (embedded metric format),
// which the alarms in infra/site.yaml watch.
export function log(severity, msg, fields = {}, metric) {
  const line = { severity, msg, ...fields };
  if (metric) {
    line._aws = { Timestamp: Date.now(), CloudWatchMetrics: [{ Namespace: 'CinderellaMaze', Dimensions: [[]], Metrics: [{ Name: metric, Unit: 'Count' }] }] };
    line[metric] = 1;
  }
  console.log(JSON.stringify(line));
}

const sameSecret = (a, b) => {
  const x = Buffer.from(String(a ?? '')), y = Buffer.from(String(b ?? ''));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
};

// CloudFront adds the visitor's address as "ip:port" ("[v6]:port" or "v6:port" for IPv6).
export function viewerIp(headers) {
  const raw = String(headers['cloudfront-viewer-address'] ?? '').trim();
  const i = raw.lastIndexOf(':');
  return (i > 0 ? raw.slice(0, i) : raw).replace(/^\[|\]$/g, '') || 'unknown';
}

const publicEntry = s => ({ id: s.id, name: s.name, score: s.score, level: s.level, done: s.done === true });

export function makeApp({ store, secret, now = () => Date.now() }) {
  // Players are told apart by a salted hash of their address; the address itself is never stored.
  const player = headers => createHash('sha256').update(secret + '|' + viewerIp(headers)).digest('base64url').slice(0, 22);
  const scoreId = session => createHash('sha256').update('score|' + session).digest('base64url').slice(0, 16);

  async function allowed(kind, who) {
    const hour = Math.floor(now() / 3_600_000);
    const ok = await store.hit(`R#${kind}#${who}#${hour}`, LIMITS[kind].perHour, (hour + 2) * 3600);
    if (!ok) log('warn', 'rate limited', { kind }, 'RateLimited');
    return ok;
  }

  async function board(name) {
    return (await store.top(name, TOP_N)).map(publicEntry);
  }

  async function startSession(body, who) {
    if (!(await allowed('session', who))) return json(429, { error: 'busy' });
    const id = randomBytes(16).toString('base64url');
    const t = now();
    await store.createSession({ pk: 'S#' + id, easy: body.easy === true, started: t, ttl: Math.floor(t / 1000) + SESSION_TTL_HOURS * 3600 });
    return json(201, { session: id });
  }

  async function submitScore(body, who) {
    const { session } = body;
    const name = cleanName(body.name);
    const sub = { name, score: body.score, level: body.level, done: body.done === true };
    if (typeof session !== 'string' || !SESSION_ID.test(session)) return json(400, { error: 'invalid' });
    const bad = nameProblem(name);
    if (bad) { log('info', 'name refused', { reason: bad }, bad === 'words' ? 'NameRefused' : undefined); return json(400, { error: 'name' }); }
    if (!(await allowed('score', who))) return json(429, { error: 'busy' });

    const s = await store.getSession('S#' + session);
    if (!s) return json(410, { error: 'session' });
    const boardName = s.easy ? 'easy' : 'normal';
    const id = scoreId(session);
    const finish = async status => {
      const rank = (await store.countAbove(boardName, sub.score)) + 1;
      return json(status, { id, rank, board: boardName, top: await board(boardName) });
    };
    // A game gives one score. Sending the same score again (a retry) gets the same answer.
    if (s.submitted) {
      const same = ['name', 'score', 'level', 'done'].every(k => s.submitted[k] === sub[k]);
      return same ? finish(200) : json(409, { error: 'used' });
    }
    const why = scoreProblem({ score: sub.score, level: sub.level, done: sub.done, elapsedSeconds: (now() - s.started) / 1000 });
    if (why) { log('warn', 'score refused', { reason: why, level: sub.level, score: sub.score }, 'ScoreRefused'); return json(422, { error: 'refused' }); }

    const item = { pk: 'H#' + id, id, board: boardName, name, score: sub.score, level: sub.level, done: sub.done, at: new Date(now()).toISOString() };
    const saved = await store.recordScore('S#' + session, item, sub);
    if (!saved) return submitScore(body, who); // another copy of this request won the race: answer as a retry
    log('info', 'score saved', { board: boardName, level: sub.level, score: sub.score }, 'ScoreSaved');
    return finish(201);
  }

  return async function handle(event) {
    const method = event.requestContext?.http?.method ?? 'GET';
    const path = event.rawPath ?? '';
    const headers = event.headers ?? {};
    // Only CloudFront knows this header's value, so calls that skip CloudFront get nothing.
    if (!sameSecret(headers['x-origin-verify'], secret)) return json(404, { error: 'not found' });
    try {
      if (method === 'GET' && path === '/api/scores') {
        const name = event.queryStringParameters?.board ?? 'normal';
        if (!BOARDS.includes(name)) return json(400, { error: 'invalid' });
        return json(200, { board: name, top: await board(name) }, 'public, max-age=5');
      }
      if (method === 'POST' && (path === '/api/session' || path === '/api/scores')) {
        const raw = event.isBase64Encoded ? Buffer.from(event.body ?? '', 'base64').toString('utf8') : event.body ?? '';
        if (raw.length > MAX_BODY) return json(413, { error: 'too large' });
        let body;
        try { body = JSON.parse(raw || '{}'); } catch { return json(400, { error: 'invalid' }); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { error: 'invalid' });
        const who = player(headers);
        return path === '/api/session' ? await startSession(body, who) : await submitScore(body, who);
      }
      return json(404, { error: 'not found' });
    } catch (e) {
      log('error', 'request failed', { path, error: String(e?.name ?? e), detail: String(e?.message ?? '') });
      return json(500, { error: 'server' });
    }
  };
}
