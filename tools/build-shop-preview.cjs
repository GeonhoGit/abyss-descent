'use strict';

// Starts the actual game at the merchant without reading or writing real progress.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { loadGame } = require('../tests/game-harness.cjs');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const bootstrap = 'p=newPlayer();p.ended=true;genLevel();resize();showBest();';
const persist = source.match(/^function persist\(\)\{[^\r\n]*\}$/m)?.[0];
assert.ok(source.includes(bootstrap) && source.includes(persist), 'Review changed game bootstrap');
const preview = source
  .replace('<title>심연 강하 — 1인칭 로그라이크</title>', '<title>상인 화면 미리보기 — 심연 강하</title>')
  .replace("const SAVE_KEY='abyss_save_v2';", "const SAVE_KEY='abyss_shop_preview';")
  .replace('const RUN_SAVE_ENABLED=true;', 'const RUN_SAVE_ENABLED=false;')
  .replace(persist, 'function persist(){return true;} // This preview never writes player progress.')
  .replace(bootstrap, bootstrap + `
p.gold=80;p.hp=p.maxhp;p.time=3;p.ended=false;floorN=2;
p.w=1;p.has=[true,true,true,true,true,false];p.ammo.b=64;p.at=9;
openShop();
{
  const u=UPG.find(u=>u.id==='crit');
  shopStock[shopStock.length-1]={kind:'tome',art:u.id,n:'비전서: '+u.n,d:u.d,cost:70+floorN*8,f:()=>{u.f();p.ups[u.id]=(p.ups[u.id]||0)+1;}};
}
renderShop();show('title',false);show('shop',true);draw();`);
const game = loadGame({ source: preview, savedData: { souls: 987, meta: { vigor: 5 } } });
assert.equal(game.run('state'), 'shop');
assert.equal(game.element('shop').classList.contains('hidden'), false);
assert.equal(game.element('title').classList.contains('hidden'), true);
assert.equal(game.run('p.maxhp'), 100);
assert.equal(game.run('JSON.stringify(shopStock.map(it=>it.cost))'), '[30,25,120,86]');
assert.equal(game.run('shopStock[2].art'), 'staff');
const stored = [...game.storage.entries()];
game.run('save.souls=1;persist();frame(16);');
assert.deepEqual([...game.storage.entries()], stored);
assert.equal(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), source);
const output = path.join(root, 'previews', 'shop-preview.html');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, preview, 'utf8');
console.log(`PASS: merchant opens with actual stock/prices, isolated progress, no writes; saved ${output}`);
