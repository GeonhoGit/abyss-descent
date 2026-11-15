const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

test('holding E does not close the shop on a repeated keydown', () => {
  const game = loadGame();
  game.run("state='shop';");
  game.dispatch('document', 'keydown', { code: 'KeyE', repeat: true });
  assert.equal(game.run('state'), 'shop');

  game.dispatch('document', 'keydown', { code: 'KeyE', repeat: false });
  assert.equal(game.run('state'), 'play');
});

test('repeated number keys do not choose another level upgrade', () => {
  const game = loadGame();
  game.run("state='play';p.xp=200;levelUp();");
  const before = game.run('JSON.stringify({lv:p.lv,xp:p.xp,ups:p.ups})');
  game.dispatch('document', 'keydown', { code: 'Digit1', repeat: true });
  assert.equal(game.run('JSON.stringify({lv:p.lv,xp:p.xp,ups:p.ups})'), before);

  game.dispatch('document', 'keydown', { code: 'Digit1', repeat: false });
  assert.notEqual(game.run('JSON.stringify({lv:p.lv,xp:p.xp,ups:p.ups})'), before);
});

test('paused settings keep native keyboard navigation available', () => {
  const game = loadGame();
  game.run("state='play';locked=false;panel='settings';");
  for (const code of ['Tab', 'Space', 'ArrowUp', 'ArrowDown']) {
    const event = game.dispatch('document', 'keydown', { code, repeat: false });
    assert.equal(event.defaultPrevented, false, `${code} must reach the focused menu control`);
  }
});

test('pointer lock loss clears pending actions before gameplay resumes', () => {
  const game = loadGame();
  game.run("state='play';locked=true;keys.KeyW=true;mouseL=mouseRReq=dashReq=eReq=shockReq=true;");
  game.document.pointerLockElement = null;
  game.dispatch('document', 'pointerlockchange');
  assert.equal(game.run('locked'), false);
  assert.equal(game.run('!!(keys.KeyW||mouseL||mouseRReq||dashReq||eReq||shockReq)'), false);
});

test('window blur pauses gameplay and clears queued actions', () => {
  const game = loadGame();
  game.run("state='play';lock();keys.KeyW=true;mouseL=mouseRReq=dashReq=eReq=shockReq=true;");
  game.dispatch('window', 'blur');
  assert.equal(game.run('locked'), false);
  assert.equal(game.run('!!(keys.KeyW||mouseL||mouseRReq||dashReq||eReq||shockReq)'), false);
});

test('a fresh run does not inherit movement or pending actions', () => {
  const game = loadGame();
  game.run('keys.KeyW=true;mouseL=mouseRReq=dashReq=eReq=shockReq=true;startGame();');
  assert.equal(game.run('state'), 'play');
  assert.equal(game.run('!!(keys.KeyW||mouseL||mouseRReq||dashReq||eReq||shockReq)'), false);
});

test('invalid saved field types and ranges cannot poison player state', () => {
  const game = loadGame({ savedData: {
    souls: '100', best: -5, wins: {}, runs: -2,
    sens: 'broken', vol: 8, mus: -1, q: 9,
    meta: { vigor: 'broken', edge: 999, greed: -1, revive: 7 }
  } });
  assert.equal(game.run('Number.isFinite(p.hp)&&p.hp>=100&&p.hp<=150'), true);
  assert.equal(game.run('Number.isFinite(save.souls)&&save.souls>=0'), true);
  assert.equal(game.run('Number.isInteger(save.best)&&save.best>=0&&Number.isInteger(save.wins)&&save.wins>=0&&Number.isInteger(save.runs)&&save.runs>=0'), true);
  assert.equal(game.run('Number.isFinite(save.sens)&&save.sens>=.2&&save.sens<=3'), true);
  assert.equal(game.run('Number.isFinite(save.vol)&&save.vol>=0&&save.vol<=1&&Number.isFinite(save.mus)&&save.mus>=0&&save.mus<=1'), true);
  assert.equal(game.run('Number.isInteger(save.q)&&save.q>=0&&save.q<=2'), true);
  assert.equal(game.run('META.every(m=>Number.isInteger(ml(m.id))&&ml(m.id)>=0&&ml(m.id)<=m.max)'), true);
  game.run("state='play';locked=true;");
  game.dispatch('document', 'mousemove', { movementX: 12, movementY: -5 });
  assert.equal(game.run('Number.isFinite(p.a)&&Number.isFinite(p.pitch)'), true);
});

test('valid saved progress and settings are preserved', () => {
  const savedData = {
    souls: 87, best: 9, wins: 1, runs: 4,
    sens: 1.4, vol: .3, mus: .6, q: 2,
    meta: { vigor: 3, edge: 2, wisdom: 1, greed: 2, pistol: 1, revive: 1 }
  };
  const game = loadGame({ savedData });
  const actual = JSON.parse(game.run('JSON.stringify(save)'));
  for (const [key, value] of Object.entries(savedData)) assert.deepEqual(actual[key], value, key);
  assert.equal(game.run('p.maxhp'), 130);
  assert.equal(game.run('p.has[1]'), true);
});
