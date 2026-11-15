'use strict';

// Rasterize the actual baked enemy textures and exercise mixed-resolution world rendering.
// node tools/render-monsters.cjs <canvas-module> [--source old.html] [--output sheet.png] [--animate]
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {loadGame}=require('../tests/game-harness.cjs');
const args=process.argv.slice(2),{createCanvas}=require(args.shift()||'@napi-rs/canvas');
let sourcePath,animate=false,output=path.join(__dirname,'..','previews','monster-details.png');
while(args.length){
  const flag=args.shift();if(flag==='--animate'){animate=true;continue;}
  const value=args.shift();assert.ok(value,'Missing option value');
  if(flag==='--source')sourcePath=path.resolve(value);
  else if(flag==='--output')output=path.resolve(value);else throw Error('Unknown option '+flag);
}
const source=fs.readFileSync(sourcePath||path.join(__dirname,'..','index.html'),'utf8');
let seed=120;
const game=loadGame({source,createCanvas,random:()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)});
const monsters=JSON.parse(game.run('JSON.stringify(Object.keys(SPF).map(id=>({id,name:ET[id].name,boss:!!ET[id].boss})))'));
const textures=monsters.map(monster=>[0,1].map(frame=>{
  const data=game.run(`SPF['${monster.id}'][${frame}]`),size=data.size||64;
  assert.equal(data.length,size*size);
  const visible=data.reduce((n,c)=>n+(c!==0),0);
  assert.ok(visible>size*size*.08&&visible<size*size*.95,monster.id+' invalid silhouette');
  assert.ok(data.every(c=>c===0||(c>>>24)===255));
  const canvas=createCanvas(size,size),g=canvas.getContext('2d'),image=g.createImageData(size,size);
  image.data.set(new Uint8Array(data.buffer,data.byteOffset,data.byteLength));g.putImageData(image,0,0);
  return canvas;
}));
for(let i=0;i<monsters.length;i++)assert.notDeepEqual(textures[i][0].toBuffer('image/png'),textures[i][1].toBuffer('image/png'),monsters[i].id+' has duplicate animation frames');
const columns=6,cw=220,ch=253,top=57;
const sheet=createCanvas(columns*cw,top+Math.ceil(monsters.length/columns)*ch+12),g=sheet.getContext('2d');
function gallery(time){
  g.fillStyle='#071113';g.fillRect(0,0,sheet.width,sheet.height);
  g.textAlign='left';g.fillStyle='#e0d2af';g.font='bold 18px Malgun Gothic';g.fillText('심연의 괴물들 · 실제 게임 스프라이트',17,27);
  g.fillStyle='#8ba89b';g.font='11px Malgun Gothic';g.fillText('뼈 · 강철 · 가죽 · 로브  /  11종, 각 2프레임',18,46);
  for(let i=0;i<monsters.length;i++){
    const x=(i%columns)*cw,y=top+Math.floor(i/columns)*ch,monster=monsters[i];
    g.fillStyle=monster.boss?'#22261f':'#17231f';g.fillRect(x+6,y+4,cw-12,ch-12);
    g.strokeStyle=monster.boss?'#8d754b':'#41584d';g.strokeRect(x+6.5,y+4.5,cw-13,ch-13);
    const frame=(Math.floor(time*(monster.id==='bat'?9:5)))&1;
    g.imageSmoothingEnabled=false;g.drawImage(textures[i][frame],x+14,y+12,192,192);
    g.fillStyle='#e1d7bc';g.font='14px Malgun Gothic';g.textAlign='center';g.fillText(monster.name,x+cw/2,y+222);
    if(monster.boss){g.fillStyle='#bca16d';g.font='9px sans-serif';g.fillText('BOSS',x+cw/2,y+237);}
  }
}
fs.mkdirSync(path.dirname(output),{recursive:true});gallery(0);fs.writeFileSync(output,sheet.toBuffer('image/png'));
console.log(`PASS: ${textures.length*2} actual sprite rasters, distinct frames, transparent silhouettes; ${output}`);

// Guard every sprite lookup, so a 128px enemy cannot accidentally use a 64px stride.
game.run(`
var checkedTexels=0,highResolutionBottomReads=0;
function guardedTexture(tex){return new Proxy(tex,{get(t,key){
  if(typeof key==='string'&&/^\\d+$/.test(key)){
    if(Number(key)>=t.length)throw Error('Sprite texel out of bounds: '+key+'/'+t.length);
    checkedTexels++;
    if(t.size===128&&Number(key)>=t.length*.75)highResolutionBottomReads++;
  }
  return Reflect.get(t,key,t);
}});}
for(const id of Object.keys(SPF))SPF[id]=SPF[id].map(guardedTexture);
for(const id of Object.keys(SP))SP[id]=guardedTexture(SP[id]);
p=newPlayer();state='play';floorN=3;themeI=0;p.x=20.5;p.y=20.5;p.a=0;p.time=0;p.w=1;p.has[1]=true;
map.fill(1);seen.fill(0);light.fill(180);for(let y=15;y<27;y++)for(let x=15;x<29;x++)map[y*MS+x]=0;
items=[{x:22.5,y:19.8,type:'hp'},{x:22.9,y:21.3,type:'chest'}];
portal={x:27.5,y:20.5,cx:27,cy:20,open:true};shots=[];pshots=[];parts=[];fxs=[];msgs=[];
`);
let renders=0;
for(let q=0;q<3;q++)for(const monster of monsters)for(let frame=0;frame<2;frame++){
  game.run(`setRes(${q});enemies=[];var specimen=spawnEnemy('${monster.id}',23,20.5);specimen.mv=true;specimen.anim=${frame?.22:0};render3D();`);
  assert.equal(game.run('zbuf.every(v=>Number.isFinite(v)&&v>0)'),true);renders++;
}
for(const monster of monsters)for(const mode of ['hit','attack','elite']){
  game.run(`enemies=[];var specimen=spawnEnemy('${monster.id}',22.2,20.5,${mode==='elite'});specimen.flash=${mode==='hit'? .1:0};specimen.wind=${mode==='attack'?.2:0};specimen.wk='melee';render3D();`);renders++;
}
assert.ok(game.run('checkedTexels')>10000);
if(game.run('SPF.slime[0].size===128'))assert.ok(game.run('highResolutionBottomReads')>1000,'128px sampling must reach the bottom quarter of the enemy texture');
console.log(`PASS: ${renders} world renders, all qualities/frames/hit/attack/elite effects; ${game.run('checkedTexels')} sprite indices in bounds`);

if(animate){
  const frames=[];for(let i=0;i<40;i++){gallery(i/10);frames.push(sheet.toBuffer('image/png'));}
  const gif=output.replace(/\.png$/i,'')+'.gif';
  const encoded=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','10','-vcodec','png','-i','pipe:0','-filter_complex','[0:v]split[a][b];[a]palettegen[p];[b][p]paletteuse=dither=bayer:bayer_scale=4','-loop','0',gif],{input:Buffer.concat(frames),windowsHide:true,maxBuffer:1024*1024});
  assert.equal(encoded.status,0,encoded.stderr?.toString());assert.ok(fs.statSync(gif).size>0);
  console.log(`PASS: 40 animation frames from actual textures; ${gif}`);
}
