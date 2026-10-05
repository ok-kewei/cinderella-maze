// An in-memory stand-in for store-dynamodb.mjs with the same behaviour, for tests.
export function memoryStore() {
  const items = new Map();
  const scores = board => [...items.values()].filter(i => i.board === board).sort((a, b) => b.score - a.score);
  return {
    items,
    async hit(pk, limit, ttl) {
      const it = items.get(pk) ?? { pk, n: 0, ttl };
      if (it.n >= limit) return false;
      it.n++; items.set(pk, it); return true;
    },
    async createSession(item) {
      if (items.has(item.pk)) throw Object.assign(new Error('exists'), { name: 'ConditionalCheckFailedException' });
      items.set(item.pk, { ...item });
    },
    async getSession(pk) { return items.get(pk) ?? null; },
    async recordScore(sessionPk, item, submitted) {
      const s = items.get(sessionPk);
      if (!s || s.submitted || items.has(item.pk)) return false;
      items.set(item.pk, { ...item }); s.submitted = { ...submitted }; return true;
    },
    async top(board, limit) { return scores(board).slice(0, limit); },
    async countAbove(board, score) { return scores(board).filter(i => i.score > score).length; },
  };
}
