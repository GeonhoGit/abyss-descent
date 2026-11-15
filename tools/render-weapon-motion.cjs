'use strict';

// Optional offline motion review; the real game script and renderer are unchanged.
// node tools/render-weapon-motion.cjs <path-to-@napi-rs/canvas>
//   [--source <snapshot.html>] [--output <sheet.png>] [--animate] [--relics]
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { loadGame } = require('../tests/game-harness.cjs');

const args = process.argv.slice(2);
const canvasModule = args[0] && !args[0].startsWith('--') ? args.shift() : '@napi-rs/canvas';
let sourcePath;
let animate = false;
let relics = false;
let outputPath = path.join(__dirname, '..', 'previews', 'weapon-motion.png');
while (args.length) {
  const flag = args.shift();
  if (flag === '--animate') { animate = true; continue; }
  if (flag === '--relics') { relics = true; continue; }
  const value = args.shift();
  assert.ok(value && !value.startsWith('--'), `Missing value for ${flag}`);
  if (flag === '--source') sourcePath = path.resolve(value);
  else if (flag === '--output') outputPath = path.resolve(value);
  else throw new Error(`Unknown option: ${flag}`);
}

const { createCanvas } = require(canvasModule);
const source = fs.readFileSync(sourcePath || path.join(__dirname, '..', 'index.html'), 'utf8');
let seed = 120;
const game = loadGame({
  createCanvas,
  source,
  random: () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296),
});
const canvas = game.element('c');
canvas.width = 480;
canvas.height = 270;

function reset(weapon, target = game) {
  seed = 120;
  target.run(`
    p=newPlayer();state='play';floorN=3;themeI=0;
    map.fill(1);seen.fill(0);light.fill(112);
    for(let y=2;y<MS-2;y++)for(let x=2;x<MS-2;x++)map[y*MS+x]=0;
    p.x=16.5;p.y=16.5;p.a=0;p.time=3;p.w=${weapon};
    p.has=[true,true,true,true,true,true];p.ammo={b:999,s:999};
    enemies=[];items=[];shots=[];pshots=[];fxs=[];parts=[];dnums=[];msgs=[];
    portal={x:3.5,y:3.5,cx:3,cy:3,open:false};
    boss=null;bossFloor=false;needK=6;killsF=0;
    for(const key of Object.keys(keys))delete keys[key];
    mouseL=false;mouseRReq=false;dashReq=false;eReq=false;shockReq=false;
    shake=0;glow=0;hitT=0;emptyT=0;
  `);
}

function advance(seconds) {
  // A shared small timestep preserves fast recoil without depending on a pose API.
  game.run(`{
    let remaining=${seconds};
    while(remaining>1e-9){const dt=Math.min(1/240,remaining);update(dt);remaining-=dt;}
  }`);
}

const weapons = relics ? [
  { id: 4, label: 'CROSSBOW', peak: .05, recover: .68 },
  { id: 5, label: 'FLAME STAFF', peak: .12, recover: .27 },
] : [
  { id: 1, label: 'PISTOL', peak: .042, recover: .19 },
  { id: 2, label: 'SHOTGUN', peak: .05, recover: .21 },
  { id: 3, label: 'SMG', peak: .033, recover: .075 },
];
const phases = [
  { label: 'IDLE', run() { advance(.25); } },
  { label: 'SHOT / ONSET', run() { game.run('attack()'); } },
  { label: 'RECOIL SAMPLE', run(weapon) { game.run('attack()');advance(weapon.peak); } },
  { label: 'RECOVERY', run(weapon) { game.run('attack()');advance(weapon.recover); } },
  { label: relics ? 'CYCLE / RELOAD' : 'CYCLE / SHOTGUN PUMP', run() { game.run('attack()');advance(game.run('WEP[p.w].cd*.55')); } },
  { label: 'HOLD FIRE / 4 CYCLES', run(weapon) { game.run('mouseL=true;attack()');advance(game.run('WEP[p.w].cd*4')+weapon.peak); } },
  { label: 'WALK / 650 ms', run() { game.run('keys.KeyW=true');advance(.65); } },
  { label: 'DASH / 80 ms', run() { game.run('keys.KeyW=true;dashReq=true');advance(.08); } },
];
if (relics) phases.push(
  { label: 'EMPTY / NO SHOT', run() {
    game.run('p.ammo.b=0;p.mana=0;');
    const before = game.run('JSON.stringify({at:p.at,flash:p.flash,shots:pshots.length})');
    game.run('attack()');
    assert.equal(game.run('JSON.stringify({at:p.at,flash:p.flash,shots:pshots.length})'), before);
  } },
  { label: 'RESOURCE RESTORED', run() {
    game.run('p.mana=100;p.ammo.b=3;attack()');advance(.07);
  } },
);

const width = 480;
const height = 270;
const gap = 12;
const titleHeight = 62;
const captionHeight = 29;
const sheet = createCanvas(gap + weapons.length * (width + gap), titleHeight + phases.length * (height + captionHeight + gap) + gap);
const g = sheet.getContext('2d');
g.fillStyle = '#050e11';
g.fillRect(0, 0, sheet.width, sheet.height);
g.fillStyle = '#e2d9bc';
g.font = 'bold 18px sans-serif';
g.fillText('WEAPON MOTION / REAL drawWeapon() + attack() + update()', gap, 25);
g.fillStyle = '#7faaa7';
g.font = '12px sans-serif';
g.fillText(`${sourcePath ? path.basename(sourcePath) : 'index.html'} | 480 x 270 logical viewport | thin line = viewport bottom`, gap, 46);

let renders = 0;
for (let row = 0; row < phases.length; row++) {
  for (let col = 0; col < weapons.length; col++) {
    const weapon = weapons[col];
    const phase = phases[row];
    reset(weapon.id);
    phase.run(weapon);
    const beforeDraw = game.run('JSON.stringify(p)');
    game.run('ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,480,270);drawWeapon(ctx);');
    assert.equal(game.run('JSON.stringify(p)'), beforeDraw, 'Drawing must not mutate player state');
    const state = game.run('({at:p.at,time:p.time,x:p.x,y:p.y,hp:p.hp,weapon:p.w})');
    for (const value of Object.values(state)) assert.ok(Number.isFinite(value), 'Non-finite player state');
    assert.equal(state.weapon, weapon.id);
    assert.equal(game.run('state'), 'play');
    const pixels = canvas.getContext('2d').getImageData(0, 0, width, height).data;
    let visiblePixels = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) visiblePixels++;
    assert.ok(visiblePixels > 100, `${weapon.label}/${phase.label}: weapon was not rendered`);

    const x = gap + col * (width + gap);
    const y = titleHeight + row * (height + captionHeight + gap);
    g.fillStyle = '#0b1d20';
    g.fillRect(x, y, width, height);
    g.drawImage(canvas, x, y);
    g.strokeStyle = '#41716e';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y + height - .5);
    g.lineTo(x + width, y + height - .5);
    g.stroke();
    g.fillStyle = '#d5c6a4';
    g.font = 'bold 11px sans-serif';
    g.fillText(`${weapon.label} / ${phase.label}`, x + 7, y + 17);
    g.fillStyle = '#99b7b2';
    g.font = '11px sans-serif';
    g.fillText(`shot age ${Math.round(state.at * 1000)} ms  |  time ${state.time.toFixed(3)} s`, x + 7, y + height + 18);
    renders++;
  }
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, sheet.toBuffer('image/png'));
console.log(`PASS: ${renders} real weapon renders (${sheet.width} x ${sheet.height}); saved ${outputPath}`);

if (relics) {
  // Extend the drawing surface to reveal the grip below the normal viewport.
  const detail = createCanvas(980, 724), dg = detail.getContext('2d');
  dg.fillStyle = '#081519';dg.fillRect(0,0,detail.width,detail.height);
  canvas.height = 360;
  for (let col=0;col<weapons.length;col++) {
    reset(weapons[col].id);
    game.run('ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,480,360);drawWeapon(ctx);');
    const pixels=canvas.getContext('2d').getImageData(0,0,480,360).data;
    let left=480,right=0,top=360,bottom=0;
    for(let y=0;y<360;y++)for(let x=0;x<480;x++)if(pixels[(y*480+x)*4+3]){
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
    left=Math.max(0,left-8);top=Math.max(0,top-8);right=Math.min(480,right+9);bottom=Math.min(360,bottom+9);
    const cw=right-left,ch=bottom-top,scale=Math.min(3,440/cw,640/ch),x=col*490+(490-cw*scale)/2,y=62+(640-ch*scale)/2;
    dg.imageSmoothingEnabled=false;dg.drawImage(canvas,left,top,cw,ch,x,y,cw*scale,ch*scale);
    dg.fillStyle='#dfd2b1';dg.font='bold 16px sans-serif';dg.fillText(weapons[col].label,col*490+24,28);
    dg.fillStyle='#87a99c';dg.font='11px sans-serif';dg.fillText('REAL drawWeapon() / extended crop',col*490+24,47);
  }
  canvas.height=270;
  const detailPath=outputPath.replace(/\.png$/i,'')+'-detail.png';
  fs.writeFileSync(detailPath,detail.toBuffer('image/png'));
  console.log(`PASS: two actual weapon detail crops; saved ${detailPath}`);
}

if (animate) {
  const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', windowsHide: true });
  assert.equal(ffmpeg.status, 0, `--animate requires an existing ffmpeg executable: ${ffmpeg.error?.message || ffmpeg.stderr}`);
  const gifPath = outputPath.replace(/\.png$/i, '') + '.gif';
  const fps = 24;
  const frameCount = fps * 5;
  const panelWidth = relics ? 420 : 320;
  const panelHeight = relics ? 360 : 180;
  const animation = createCanvas(panelWidth * weapons.length, panelHeight + 48);
  const ag = animation.getContext('2d');
  const games = weapons.map(weapon => {
    let animationSeed = 120;
    const target = loadGame({
      createCanvas,
      source,
      random: () => ((animationSeed = (animationSeed * 1664525 + 1013904223) >>> 0) / 4294967296),
    });
    const targetCanvas = target.element('c');
    targetCanvas.width = 480;
    targetCanvas.height = 270;
    reset(weapon.id, target);
    target.run('var previewElapsed=0,previewShot=false,previewDash=false;');
    return target;
  });
  const frames = [];
  for (let frame = 0; frame < frameCount; frame++) {
    const elapsed = frame / fps;
    const phase = elapsed < .5 ? 'IDLE' : elapsed < 1.35 ? 'SINGLE SHOT / RECOVERY'
      : elapsed < 2.8 ? 'HOLD FIRE' : elapsed < 3.65 ? 'WALK'
        : elapsed < 3.9 ? 'DASH' : 'SETTLE';
    ag.fillStyle = '#050e11';
    ag.fillRect(0, 0, animation.width, animation.height);
    for (let col = 0; col < games.length; col++) {
      const target = games[col];
      if (frame > 0) target.run(`
        for(let step=0;step<10;step++){
          const next=previewElapsed+1/240;
          if(next>=.5&&!previewShot){attack();previewShot=true;}
          mouseL=next>=1.35&&next<2.8;
          keys.KeyW=next>=2.8&&next<3.9;
          if(next>=3.65&&!previewDash){dashReq=true;previewDash=true;}
          update(1/240);previewElapsed=next;
        }
      `);
      target.run('ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,480,270);drawWeapon(ctx);');
      assert.equal(target.run('state'), 'play');
      assert.equal(target.run('Number.isFinite(p.x+p.y+p.at+p.time)'), true);
      const x = col * panelWidth;
      ag.fillStyle = '#0b1d20';
      ag.fillRect(x, 24, panelWidth, panelHeight);
      ag.imageSmoothingEnabled = false;
      if(relics)ag.drawImage(target.element('c'),170,30,280,240,x,24,panelWidth,panelHeight);
      else ag.drawImage(target.element('c'), x, 24, panelWidth, panelHeight);
      ag.fillStyle = '#d5c6a4';
      ag.font = 'bold 12px sans-serif';
      ag.fillText(weapons[col].label, x + 9, 16);
      ag.fillStyle = '#41716e';
      ag.fillRect(x, 24 + panelHeight - 1, panelWidth, 1);
    }
    ag.fillStyle = '#b7cebf';
    ag.font = '12px sans-serif';
    ag.fillText(`${phase}  /  ${elapsed.toFixed(2)} s`, 9, animation.height - 7);
    frames.push(animation.toBuffer('image/png'));
  }
  const encoded = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(fps), '-vcodec', 'png', '-i', 'pipe:0',
    '-filter_complex', '[0:v]split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4',
    '-loop', '0', gifPath,
  ], { input: Buffer.concat(frames), windowsHide: true, maxBuffer: 1024 * 1024 });
  assert.equal(encoded.status, 0, `GIF encoding failed: ${encoded.error?.message || encoded.stderr?.toString()}`);
  assert.ok(fs.statSync(gifPath).size > 0, 'GIF output is empty');
  console.log(`PASS: ${frameCount} frames at ${fps} fps (${animation.width} x ${animation.height}); saved ${gifPath}`);
}
