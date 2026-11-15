'use strict';

// Offline captures from the real HUD; no saved progress is read or written.
// node tools/render-abilities.cjs <path-to-@napi-rs/canvas>
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createCanvas}=require(process.argv[2]||'@napi-rs/canvas');
const {loadGame}=require('../tests/game-harness.cjs');
let seed=120;
const source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').replace('const RUN_SAVE_ENABLED=true;','const RUN_SAVE_ENABLED=false;');
const game=loadGame({source,createCanvas,random:()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)});
const out=path.join(__dirname,'..','previews');fs.mkdirSync(out,{recursive:true});
game.window.innerWidth=1280;game.window.innerHeight=720;
game.run('startGame();resize();setRes(2);msgs=[];');
game.dispatch('document','keydown',{code:'Tab'});
game.dispatch('document','keyup',{code:'Tab'});game.run('draw()');
assert.equal(game.run('infoView'),'abilities','The panel must stay open after releasing Tab');
fs.writeFileSync(path.join(out,'abilities-empty.png'),game.element('c').toBuffer('image/png'));
game.run(`
  for(const [id,n] of Object.entries({hp:2,sword:3,gun:1,rate:2,crit:1,armor:2,regen:2,shock:3,orbit:2,frost:1})){
    const u=UPG.find(u=>u.id===id);for(let j=0;j<n;j++)u.f();p.ups[id]=n;
  }
  p.lv=12;draw();
`);
fs.writeFileSync(path.join(out,'abilities.png'),game.element('c').toBuffer('image/png'));
game.run(`
  for(const u of UPG)if(!p.ups[u.id]){u.f();p.ups[u.id]=1;}
  draw();
`);
fs.writeFileSync(path.join(out,'abilities-all.png'),game.element('c').toBuffer('image/png'));
// Measure actual glyphs at the larger, normal list font as a conservative width check.
assert.equal(game.run(`ctx.font='7px '+FONT;getOwnedUpgrades().every(u=>ctx.measureText(u.effect).width<=198)`),true,'An ability description crosses into the next column');
game.dispatch('document','keydown',{code:'KeyM'});game.run('draw()');
game.dispatch('document','keyup',{code:'KeyM'});
assert.equal(game.run('infoView'),'map','M switches from abilities to the map and stays open');
fs.writeFileSync(path.join(out,'map-key-m.png'),game.element('c').toBuffer('image/png'));
let renders=0;
for(let q=0;q<3;q++){
  game.run(`setRes(${q})`);
  for(const view of [null,'abilities','map']){
    game.run(`infoView=${JSON.stringify(view)};draw()`);renders++;
    assert.equal(game.run('zbuf.every(v=>Number.isFinite(v)&&v>0)'),true);
  }
}
assert.equal(game.storage.size,0);
console.log(`PASS: empty/10/19 abilities and M map captures, actual glyph widths, ${renders} quality/input renders, no saved-progress writes.`);
