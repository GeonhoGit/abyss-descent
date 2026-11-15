'use strict';

// Offline native Canvas review of the unmodified game's sword renderer and timing.
// node tools/render-sword-preview.cjs [path-to-@napi-rs/canvas]
//   [--source snapshot.html] [--output previews/sword-motion.png] [--animate]
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { loadGame } = require('../tests/game-harness.cjs');

const args = process.argv.slice(2);
const canvasModule = args[0] && !args[0].startsWith('--') ? args.shift() : '@napi-rs/canvas';
let sourcePath;
let animate = false;
let outputPath = path.join(__dirname, '..', 'previews', 'sword-motion.png');
while (args.length) {
  const flag = args.shift();
  if (flag === '--animate') { animate = true; continue; }
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
  createCanvas, source,
  random: () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296),
});
const canvas = game.element('c');
const width = 480;
const height = 270;
canvas.width = width;
canvas.height = height;

function reset() {
  seed = 120;
  game.run(`
    p=newPlayer();state='play';floorN=3;themeI=0;
    map.fill(1);seen.fill(0);light.fill(112);
    for(let y=2;y<MS-2;y++)for(let x=2;x<MS-2;x++)map[y*MS+x]=0;
    p.x=16.5;p.y=16.5;p.a=0;p.time=3;p.w=0;
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
  assert.ok(Number.isFinite(seconds) && seconds >= 0, 'Invalid timestep');
  game.run(`{
    let remaining=${seconds};
    while(remaining>1e-9){const dt=Math.min(1/240,remaining);update(dt);remaining-=dt;}
  }`);
}

function beginCombo(combo) {
  reset();
  for (let attack = 0; attack <= combo; attack++) {
    if (attack) advance(Math.max(0, game.run('p.cd')) + 1 / 240);
    assert.ok(game.run('p.cd') <= 0, 'Attack started before cooldown completed');
    game.run('attack()');
    assert.equal(game.run('p.combo'), attack, 'Actual combo progression differs');
  }
}

function inspect() {
  const state = game.run('({combo:p.combo,swing:p.swing,duration:p.swingD,at:p.at,time:p.time,x:p.x,y:p.y,hp:p.hp,cd:p.cd})');
  for (const value of Object.values(state)) assert.ok(Number.isFinite(value), 'Non-finite player state');
  assert.equal(game.run('p.w'), 0);
  assert.equal(game.run('state'), 'play');
  const pose = game.run('swPose(p.combo,clamp(1-p.swing/p.swingD,0,1))');
  assert.ok(pose.every(Number.isFinite), 'Non-finite sword pose');
  return state;
}

function render(allowOffscreenSwing = false) {
  game.run(`ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,${canvas.width},${canvas.height});drawWeapon(ctx);`);
  const state = inspect();
  const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let visiblePixels = 0;
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) visiblePixels++;
  // The existing recovery keyframes intentionally carry the sword entirely below
  // the viewport. A continuous animation must preserve those offscreen frames.
  assert.ok(visiblePixels > 100 || (allowOffscreenSwing && state.swing > 0), 'Actual sword renderer produced no visible sword');
  return { ...state, visiblePixels };
}

const combos = ['01 / RIGHT CUT', '02 / RETURN CUT', '03 / HEAVY CUT'];
const phases = [
  { label: 'IDLE', fraction: null },
  { label: 'WINDUP', key: 1 },
  { label: 'MID SWING', key: 2 },
  { label: 'RECOVERY', key: 4, returning: true },
  { label: 'SETTLED', fraction: 1.05 },
];
const gap = 12;
const titleHeight = 64;
const captionHeight = 30;
const sheet = createCanvas(gap + combos.length * (width + gap), titleHeight + phases.length * (height + captionHeight + gap) + gap);
const g = sheet.getContext('2d');
g.fillStyle = '#050e11';
g.fillRect(0, 0, sheet.width, sheet.height);
g.fillStyle = '#e2d9bc';
g.font = 'bold 18px sans-serif';
g.fillText('SWORD / REAL drawWeapon() + attack() + update()', gap, 26);
g.fillStyle = '#7faaa7';
g.font = '12px sans-serif';
g.fillText(`${path.basename(sourcePath || 'index.html')} | 480 x 270 viewport | samples use the current SW_KEYS and swing durations`, gap, 48);

let renders = 0;
for (let row = 0; row < phases.length; row++) {
  for (let combo = 0; combo < combos.length; combo++) {
    const phase = phases[row];
    let fraction = phase.fraction;
    if (phase.label === 'IDLE') reset();
    else {
      beginCombo(combo);
      if (phase.key !== undefined) fraction = game.run(`SW_KEYS[${combo}][${phase.key}][0]`);
      if (phase.returning) fraction = (fraction + 1) / 2;
      advance(game.run('p.swingD') * fraction);
      assert.equal(game.run('p.combo'), combo);
    }
    const state = render();
    const x = gap + combo * (width + gap);
    const y = titleHeight + row * (height + captionHeight + gap);
    g.fillStyle = '#0b1d20';
    g.fillRect(x, y, width, height);
    g.drawImage(canvas, x, y);
    g.fillStyle = '#41716e';
    g.fillRect(x, y + height - 1, width, 1);
    g.fillStyle = '#d5c6a4';
    g.font = 'bold 11px sans-serif';
    g.fillText(`${combos[combo]} / ${phase.label}`, x + 8, y + 18);
    g.fillStyle = '#99b7b2';
    g.font = '11px sans-serif';
    const timing = fraction === null ? 'resting pose' : `${Math.round(state.at * 1000)} / ${Math.round(state.duration * 1000)} ms  |  ${(fraction * 100).toFixed(0)}%`;
    g.fillText(timing, x + 8, y + height + 20);
    renders++;
  }
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, sheet.toBuffer('image/png'));
console.log(`PASS: ${renders} actual sword renders (${sheet.width} x ${sheet.height}); saved ${outputPath}`);

// Extend only the output surface, keeping the game's logical coordinates and idle
// transform intact. This reveals the grip below the viewport, then enlarges the
// actual rendered pixels 3x; no replacement sword illustration is involved.
reset();
canvas.height = 360;
render();
const data = canvas.getContext('2d').getImageData(0, 0, width, canvas.height).data;
let minX = width, minY = canvas.height, maxX = -1, maxY = -1;
for (let y = 0; y < canvas.height; y++) {
  for (let x = 0; x < width; x++) {
    if (!data[(y * width + x) * 4 + 3]) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
}
assert.ok(maxX > minX && maxY > minY, 'No sword detail bounds');
minX = Math.max(0, minX - 12); minY = Math.max(0, minY - 12);
maxX = Math.min(width - 1, maxX + 12); maxY = Math.min(canvas.height - 1, maxY + 12);
const cropWidth = maxX - minX + 1;
const cropHeight = maxY - minY + 1;
const detail = createCanvas(Math.max(480, cropWidth * 3 + 40), cropHeight * 3 + 88);
const dg = detail.getContext('2d');
dg.fillStyle = '#0b1d20';
dg.fillRect(0, 0, detail.width, detail.height);
dg.fillStyle = '#e2d9bc'; dg.font = 'bold 17px sans-serif';
dg.fillText('SWORD DETAIL / ACTUAL IDLE RENDER x3', 20, 27);
dg.fillStyle = '#7faaa7'; dg.font = '12px sans-serif';
dg.fillText('Extended surface shows the grip below the viewport.', 20, 49);
const detailX = (detail.width - cropWidth * 3) / 2;
dg.imageSmoothingEnabled = false;
dg.drawImage(canvas, minX, minY, cropWidth, cropHeight, detailX, 68, cropWidth * 3, cropHeight * 3);
const viewportLine = 68 + (height - minY) * 3;
if (viewportLine > 68 && viewportLine < detail.height - 20) {
  dg.fillStyle = '#41716e';
  dg.fillRect(detailX, viewportLine, cropWidth * 3, 1);
  dg.font = '10px sans-serif';
  dg.fillText('viewport bottom', 12, viewportLine - 6);
}
const detailPath = outputPath.replace(/\.png$/i, '') + '-detail.png';
fs.writeFileSync(detailPath, detail.toBuffer('image/png'));
canvas.height = height;
console.log(`PASS: actual idle crop at 3x (${detail.width} x ${detail.height}); saved ${detailPath}`);

if (animate) {
  const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', windowsHide: true });
  assert.equal(ffmpeg.status, 0, `--animate requires an existing ffmpeg executable: ${ffmpeg.error?.message || ffmpeg.stderr}`);
  const gifPath = outputPath.replace(/\.png$/i, '') + '.gif';
  const fps = 24;
  const frameCount = fps * 5;
  const animation = createCanvas(width * 2, height * 2 + 62);
  const ag = animation.getContext('2d');
  const frames = [];
  let offscreenFrames = 0;
  reset();
  game.run('var previewElapsed=0,previewAttacks=0,previewAttackTimes=[];');
  for (let frame = 0; frame < frameCount; frame++) {
    if (frame) game.run(`
      for(let step=0;step<10;step++){
        const next=previewElapsed+1/240;
        mouseL=next>=.65&&previewAttacks<3;
        const previousAge=p.at;
        update(1/240);
        if(p.at<previousAge){
          previewAttacks++;
          previewAttackTimes.push({combo:p.combo,time:next,duration:p.swingD});
        }
        previewElapsed=next;
      }
      mouseL=false;
    `);
    const state = render(true);
    if (state.visiblePixels <= 100) offscreenFrames++;
    const elapsed = frame / fps;
    const attackCount = game.run('previewAttacks');
    const phase = attackCount === 0 ? 'IDLE' : state.swing > 0 ? combos[state.combo] : attackCount < 3 ? 'COMBO TRANSITION' : 'SETTLE';
    ag.fillStyle = '#050e11';
    ag.fillRect(0, 0, animation.width, animation.height);
    ag.fillStyle = '#0b1d20';
    ag.fillRect(0, 28, width * 2, height * 2);
    ag.imageSmoothingEnabled = false;
    ag.drawImage(canvas, 0, 28, width * 2, height * 2);
    ag.fillStyle = '#d5c6a4'; ag.font = 'bold 15px sans-serif';
    ag.fillText('SWORD / ACTUAL 3-HIT COMBO', 12, 20);
    ag.fillStyle = '#41716e';
    ag.fillRect(0, 28 + height * 2 - 1, width * 2, 1);
    ag.fillStyle = '#b7cebf'; ag.font = '14px sans-serif';
    ag.fillText(`${phase}  /  ${elapsed.toFixed(2)} s  /  attacks ${attackCount}`, 12, animation.height - 11);
    frames.push(animation.toBuffer('image/png'));
  }
  const attacks = game.run('previewAttackTimes');
  assert.deepEqual(Array.from(attacks, attack => attack.combo), [0, 1, 2], 'Animation did not execute the three real combo attacks');
  const encoded = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(fps), '-vcodec', 'png', '-i', 'pipe:0',
    '-filter_complex', '[0:v]split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4',
    '-loop', '0', gifPath,
  ], { input: Buffer.concat(frames), windowsHide: true, maxBuffer: 1024 * 1024 });
  assert.equal(encoded.status, 0, `GIF encoding failed: ${encoded.error?.message || encoded.stderr?.toString()}`);
  assert.ok(fs.statSync(gifPath).size > 0, 'GIF output is empty');
  console.log(`PASS: ${frameCount} frames at ${fps} fps (${offscreenFrames} offscreen recovery frames); real attacks ${attacks.map(a => `${a.combo + 1}@${a.time.toFixed(3)}s/${a.duration.toFixed(3)}s`).join(', ')}; saved ${gifPath}`);
}
