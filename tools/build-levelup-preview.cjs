'use strict';

// A standalone copy of the actual game, starting at the redesigned level-up screen.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { loadGame } = require('../tests/game-harness.cjs');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const bootstrap = 'p=newPlayer();p.ended=true;genLevel();resize();showBest();';
const persist = source.match(/^function persist\(\)\{[^\r\n]*\}$/m)?.[0];
assert.ok(source.includes(bootstrap) && source.includes(persist), 'Game bootstrap changed; review preview initialization');
const preview = source
  .replace('<title>심연 강하 — 1인칭 로그라이크</title>', '<title>레벨 업 화면 미리보기 — 심연 강하</title>')
  .replace("const SAVE_KEY='abyss_save_v2';", "const SAVE_KEY='abyss_levelup_preview';")
  .replace('const RUN_SAVE_ENABLED=true;', 'const RUN_SAVE_ENABLED=false;')
  .replace(persist, 'function persist(){return true;} // This preview never writes player progress.')
  .replace(bootstrap, bootstrap + `
p.lv=2;p.hp=28;p.gold=11;p.xp=0;p.time=3;p.ended=false;
p.w=1;p.has[1]=true;p.ammo.b=64;p.at=9;
state='upgrade';panel=null;
curChoices=['rate','crit','shock'].map(id=>UPG.find(u=>u.id===id));
renderUpg();show('title',false);show('upg',true);draw();`);

const game = loadGame({ source: preview, savedData: { souls: 987, best: 8, meta: { vigor: 5 } } });
assert.equal(game.run('state'), 'upgrade');
assert.equal(game.element('upg').classList.contains('hidden'), false);
assert.equal(game.element('title').classList.contains('hidden'), true);
assert.equal(game.element('cards').children.length, 3);
assert.equal(game.run('p.maxhp'), 100, 'Preview must not load real player upgrades');
assert.equal(game.run('p.lv'), 2);
assert.equal(game.run('JSON.stringify(curChoices.map(u=>u.id))'), '["rate","crit","shock"]');
const stored = [...game.storage.entries()];
game.run('save.souls=1;persist();frame(16);');
assert.deepEqual([...game.storage.entries()], stored, 'Preview must not write saved progress');
assert.equal(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), source);

const output = path.join(root, 'previews', 'levelup-preview.html');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, preview, 'utf8');
console.log(`PASS: actual game starts with three level-up cards; saves isolated and writes disabled; original game unchanged. Saved ${output}`);
