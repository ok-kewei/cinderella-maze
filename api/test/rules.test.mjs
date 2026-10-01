import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, maxScore, minSeconds, nameProblem, scoreProblem } from '../rules.mjs';

test('ordinary names are accepted', () => {
  for (const n of ['Cinderella', 'Ana Sofía', 'Zoë', '小红', 'Ong Ke Wei', "D'Arcy", 'Jean-Luc', 'Player_1', 'R2D2', 'Cassandra', 'Dickens', 'Hancock', 'Grape', 'Spice', 'Essex', 'Torpedo', 'Nazia', 'Ho']) {
    assert.equal(nameProblem(n), null, n);
  }
});

test('names are trimmed and limited to 12 characters', () => {
  assert.equal(cleanName('  Pip   and  Crumb '), 'Pip and Crumb');
  assert.equal(nameProblem(''), 'empty');
  assert.equal(nameProblem('   '), 'empty');
  assert.equal(nameProblem('Abcdefghijklm'), 'long');
  assert.equal(nameProblem('Abcdefghijkl'), null);
});

test('markup, links and symbols are refused', () => {
  for (const n of ['<b>hi</b>', 'a@b.com', 'x/y', '#1', '...', '---', 'name​']) assert.equal(nameProblem(n), 'chars', n);
});

test('rude words are refused, even disguised', () => {
  for (const n of ['fuck', 'FuCk', 'fuuuck', 'f u c k', '5h1t', 'sh!t', 'b1tch', 'Ass', 'big ass', 'kys']) assert.equal(nameProblem(n), 'words', n);
});

test('score limits grow with the level reached', () => {
  assert.ok(maxScore(1, false) > 30000);
  assert.ok(maxScore(2, false) > maxScore(1, false));
  assert.ok(maxScore(20, true) > maxScore(20, false));
  assert.equal(minSeconds(1, false), 0);
  assert.equal(minSeconds(3, false), 30);
});

test('believable scores pass', () => {
  assert.equal(scoreProblem({ score: 2400, level: 1, done: false, elapsedSeconds: 60 }), null);
  assert.equal(scoreProblem({ score: 85000, level: 6, done: false, elapsedSeconds: 600 }), null);
  assert.equal(scoreProblem({ score: 400000, level: 20, done: true, elapsedSeconds: 2400 }), null);
});

test('impossible scores are refused', () => {
  assert.equal(scoreProblem({ score: 10, level: 0, done: false, elapsedSeconds: 60 }), 'level');
  assert.equal(scoreProblem({ score: 10, level: 21, done: false, elapsedSeconds: 60 }), 'level');
  assert.equal(scoreProblem({ score: 1.5, level: 1, done: false, elapsedSeconds: 60 }), 'score');
  assert.equal(scoreProblem({ score: '100', level: 1, done: false, elapsedSeconds: 60 }), 'score');
  assert.equal(scoreProblem({ score: -5, level: 1, done: false, elapsedSeconds: 60 }), 'score');
  assert.equal(scoreProblem({ score: 100, level: 5, done: true, elapsedSeconds: 600 }), 'done');
  assert.equal(scoreProblem({ score: 999999, level: 1, done: false, elapsedSeconds: 600 }), 'too-high');
  assert.equal(scoreProblem({ score: 5000, level: 10, done: false, elapsedSeconds: 30 }), 'too-fast');
  assert.equal(scoreProblem({ score: 60000, level: 2, done: false, elapsedSeconds: 20 }), 'too-fast');
  assert.equal(scoreProblem({ score: 100, level: 1, done: false, elapsedSeconds: 13 * 3600 }), 'too-old');
});
