'use strict';

// Offline raster check of the actual dungeon renderer, with no browser or game-save writes.
// node tools/render-dungeon.cjs <canvas-module> [--source old.html] [--output prefix]
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {loadGame}=require('../tests/game-harness.cjs');
const args=process.argv.slice(2),{createCanvas}=require(args.shift()||'@napi-rs/canvas');
let sourcePath,prefix=path.join(__dirname,'..','previews','dungeon');
while(args.length){
  const flag=args.shift(),value=args.shift();assert.ok(value,'Missing option value');
  if(flag==='--source')sourcePath=path.resolve(value);
  else if(flag==='--output')prefix=path.resolve(value);else throw Error('Unknown option '+flag);
}
const source=fs.readFileSync(sourcePath||path.join(__dirname,'..','index.html'),'utf8');
let seed=120;const started=performance.now();
const game=loadGame({source,createCanvas,random:()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)});
const startup=performance.now()-started;
const themes=JSON.parse(game.run('JSON.stringify(THEMES.map(t=>t.name))'));
const materials=['wall[0]','wall[1]','wall[2]','torchB','floor','ceil'];
const labels=['석조 벽','새겨진 룬','횃불','횃불 · 두 번째 프레임','마모된 석판','교차 석조 천장'];
fs.mkdirSync(path.dirname(prefix),{recursive:true});
const atlas=createCanvas(1200,1125),ag=atlas.getContext('2d');
ag.fillStyle='#0c1515';ag.fillRect(0,0,atlas.width,atlas.height);
ag.font='13px Malgun Gothic';ag.fillStyle='#cbbb96';
for(let col=0;col<6;col++)ag.fillText(labels[col],col*200+8,23);
for(let theme=0;theme<5;theme++){
  ag.fillStyle='#cbbb96';ag.fillText(themes[theme],8,theme*216+47);
  for(let col=0;col<6;col++){
    const tex=game.run(`THEMES[${theme}].${materials[col]}`),size=tex.size||64;
    assert.equal(tex.length,size*size);
    assert.ok(tex.every(c=>(c>>>24)===255),'World materials must be opaque');
    if(tex.mips){
      assert.deepEqual(Array.from(tex.mips,t=>t.size),[128,64,32,16,8]);
      for(const mip of tex.mips)assert.equal(mip.length,mip.size*mip.size);
    }
    const canvas=createCanvas(size,size),g=canvas.getContext('2d'),image=g.createImageData(size,size);
    image.data.set(new Uint8Array(tex.buffer,tex.byteOffset,tex.byteLength));g.putImageData(image,0,0);
    ag.imageSmoothingEnabled=false;ag.drawImage(canvas,col*200+4,theme*216+56,192,192);
  }
}
fs.writeFileSync(prefix+'-materials.png',atlas.toBuffer('image/png'));

game.run(`
  p=newPlayer();state='play';floorN=3;themeI=0;
  map.fill(1);seen.fill(0);light.fill(125);
  for(let y=16;y<26;y++)for(let x=18;x<23;x++)map[y*MS+x]=0;
  for(const [x,y] of [[17,17],[17,23],[23,18],[20,15]])map[y*MS+x]=2;
  for(const [x,y,cx,cy] of [[17,20,18,20],[17,24,18,24],[23,21,22,21],[19,15,19,16],[22,15,22,16]]){
    map[y*MS+x]=3;addLight(cx,cy,325,7);
  }
  p.x=20.35;p.y=23.5;p.a=-1.86;p.pitch=0;p.hp=100;p.gold=74;p.xp=13;p.time=3;
  p.has=[true,true,true,true,true,true];p.ammo={b:64,s:12};p.w=1;
  enemies=[];items=[];shots=[];pshots=[];fxs=[];parts=[];dnums=[];msgs=[];
  portal={x:20.5,y:16.5,cx:20,cy:16,open:false};boss=null;bossFloor=false;needK=6;killsF=3;
  spawnEnemy('skel',20.6,19.7).awake=true;
  spawnEnemy('mage',21.8,17.7).awake=true;
`);
game.window.innerWidth=1280;game.window.innerHeight=720;
game.run('resize();setRes(2);draw()');
fs.writeFileSync(prefix+'-after.png',game.element('c').toBuffer('image/png'));
const sheet=createCanvas(1280,1160),sg=sheet.getContext('2d');
sg.fillStyle='#0b1414';sg.fillRect(0,0,sheet.width,sheet.height);
for(let theme=0;theme<5;theme++){
  const x=(theme%2)*640,y=Math.floor(theme/2)*386;
  game.run(`themeI=${theme};draw()`);
  sg.imageSmoothingEnabled=false;sg.drawImage(game.element('c'),x,y+26,640,360);
  sg.fillStyle='#d8c69e';sg.font='14px Malgun Gothic';sg.fillText(themes[theme],x+10,y+19);
}
game.run('themeI=0;p.pitch=48;draw()');
sg.drawImage(game.element('c'),640,798,640,360);
sg.fillStyle='#d8c69e';sg.fillText('천장 · 위를 올려다본 모습',650,791);
fs.writeFileSync(prefix+'-themes.png',sheet.toBuffer('image/png'));

// Guard the real sampler, including every mip level and low/high viewing angles.
game.run(`
  var worldReads=0,mipReads={};
  function guardedWorld(tex){return new Proxy(tex,{get(t,key){
    if(typeof key==='string'&&/^\\d+$/.test(key)){
      if(Number(key)>=t.length)throw Error('World texel out of bounds '+key+'/'+t.length);
      worldReads++;mipReads[t.size||64]=(mipReads[t.size||64]||0)+1;
    }
    return Reflect.get(t,key,t);
  }});}
  function guardedMaterial(tex){
    if(tex.mips){tex.mips=tex.mips.map(guardedWorld);return tex;}
    return guardedWorld(tex);
  }
  for(const th of THEMES){th.wall=th.wall.map(guardedMaterial);th.torchB=guardedMaterial(th.torchB);
    th.floor=guardedMaterial(th.floor);th.ceil=guardedMaterial(th.ceil);}
`);
let renders=0;
for(let q=0;q<3;q++)for(let theme=0;theme<5;theme++)for(const pitch of [-48,0,48]){
  game.run(`setRes(${q});themeI=${theme};p.pitch=${pitch};flick=${pitch===0?0:.2};render3D()`);
  assert.equal(game.run('zbuf.every(v=>Number.isFinite(v)&&v>0)'),true);renders++;
}
assert.ok(game.run('worldReads')>100000);
if(source.includes('const WORLD_TS=128;'))assert.deepEqual(Object.keys(game.run('mipReads')).map(Number).sort((a,b)=>a-b),[8,16,32,64,128]);
console.log(`PASS: 30 material rasters; ${renders} renders (5 themes, 3 qualities, 3 viewing angles), ${game.run('worldReads')} world samples in bounds; startup ${startup.toFixed(0)} ms.`);
console.log(`Saved: ${prefix}-after.png, ${prefix}-materials.png, ${prefix}-themes.png`);
