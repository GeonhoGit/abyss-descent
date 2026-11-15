'use strict';

// Optional offline visual check. The game itself has no package dependencies.
// node tools/render-preview.cjs <path-to-@napi-rs/canvas>
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createCanvas } = require(process.argv[2] || '@napi-rs/canvas');
const { loadGame } = require('../tests/game-harness.cjs');
const output = path.join(__dirname, '..', 'previews');
fs.mkdirSync(output, { recursive: true });
let seed = 120;
const game = loadGame({
  createCanvas,
  random: () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296),
});

// A fixed test chamber, not a saved player run.
game.run(`
  p=newPlayer();state='play';floorN=3;themeI=0;
  map.fill(1);seen.fill(0);light.fill(112);
  for(let y=9;y<25;y++)for(let x=11;x<21;x++)map[y*MS+x]=0;
  for(const [x,y] of [[13,13],[18,13]])map[y*MS+x]=2;
  for(const [x,y,cx,cy] of [[12,8,12,9],[19,8,19,9],[10,17,11,17],[21,17,20,17],[13,19,14,19]]){
    map[y*MS+x]=3;addLight(cx,cy,335,9);
  }
  p.x=15.5;p.y=22.5;p.a=-Math.PI/2;p.pitch=0;p.hp=83;p.gold=74;p.xp=13;p.time=3;
  p.has=[true,true,true,true,true,true];p.ammo={b:64,s:12};p.m.shock=1;
  enemies=[];items=[];shots=[];pshots=[];fxs=[];parts=[];dnums=[];msgs=[];
  portal={x:15.5,y:9.5,cx:15,cy:9,open:true};boss=null;bossFloor=false;needK=6;killsF=3;
  spawnEnemy('skel',14.1,17.1).awake=true;
  spawnEnemy('mage',17.7,15.7).awake=true;
  spawnEnemy('ogre',18.9,11.4).awake=true;
  spawnEnemy('barrel',12.1,19);
  items.push({x:18.4,y:19,type:'chest'},{x:14.7,y:18.4,type:'hp'});
`);

// Real rasterization at each supported quality and with every weapon.
game.window.innerWidth = 960;
game.window.innerHeight = 540;
game.run('resize()');
let draws = 0;
for (let quality = 0; quality < 3; quality++) {
  for (let weapon = 0; weapon < 6; weapon++) {
    game.run(`setRes(${quality});p.w=${weapon};draw();`);
    draws++;
    assert.equal(game.run('zbuf.every(v=>Number.isFinite(v)&&v>0)'), true);
  }
}

const sheet = createCanvas(1440, 540);
const sheetContext = sheet.getContext('2d');
for (let weapon = 0; weapon < 6; weapon++) {
  game.run(`p.w=${weapon};draw();`);
  sheetContext.drawImage(game.element('c'), (weapon % 3) * 480, Math.floor(weapon / 3) * 270, 480, 270);
}
fs.writeFileSync(path.join(output, 'weapons.png'), sheet.toBuffer('image/png'));

game.window.innerWidth = 1440;
game.window.innerHeight = 810;
game.run('p.w=0;resize();draw();');
fs.writeFileSync(path.join(output, 'graphics-after.png'), game.element('c').toBuffer('image/png'));
game.run("infoView='map';draw();");
game.run('infoView=null;p.hp=12;p.hurt=.2;p.revive=1;floorN=15;themeI=4;boss=spawnEnemy("lord",15.5,15.5);boss.awake=true;portal.open=false;bossFloor=true;draw();');
fs.writeFileSync(path.join(output, 'boss.png'), game.element('c').toBuffer('image/png'));
console.log(`PASS: ${draws} quality/weapon renders, full map, low HP, boss HUD; previews saved.`);
