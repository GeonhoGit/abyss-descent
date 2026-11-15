'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');

function arena(){
  const game=loadGame();
  game.run(`
    p=newPlayer();state='play';locked=true;panel=null;infoView=null;
    p.x=10.5;p.y=10.5;p.a=0;p.hp=72;p.mana=42;p.time=3;
    p.has=[true,true,true,true,true,true];p.w=1;p.ammo={b:80,s:12};
    p.cd=.6;p.dashCd=.8;p.shockCd=2;p.m.shock=1;p.m.regen=2;
    floorN=1;map.fill(1);seen.fill(0);light.fill(150);
    for(let y=5;y<25;y++)for(let x=5;x<25;x++)map[y*MS+x]=0;
    enemies=[];items=[];shots=[];pshots=[];parts=[];fxs=[];dnums=[];msgs=[];
    portal={x:23.5,y:23.5,cx:23,cy:23,open:false};boss=null;bossFloor=false;needK=99;
    var attacker=spawnEnemy('skel',14.5,10.5);attacker.awake=true;attacker.wind=.3;attacker.wk='melee';
    shots.push({x:13.5,y:10.5,vx:-2,vy:0,life:3,dmg:10,tex:SP.arrow});
    pshots.push({x:17.5,y:14.5,vx:1,vy:0,life:3,dmg:15});
    items.push({type:'coin',x:11.5,y:10.5,val:5});
    draw=()=>{};last=1000;
  `);
  return game;
}

const snapshot=`JSON.stringify({p,enemies,shots:shots.map(s=>({...s,tex:undefined})),pshots,items,flick,glow,shake,flowT})`;
const pending=`!!(mouseL||mouseRReq||dashReq||shockReq||eReq||keys.KeyW||keys.KeyA||keys.KeyS||keys.KeyD||keys.ArrowUp||keys.ArrowDown)`;

test('both information views freeze the simulation and resume with only the next frame delta',()=>{
  const game=arena();
  game.dispatch('document','keydown',{code:'Tab'});
  assert.equal(game.run('infoView'),'abilities');
  const before=game.run(snapshot);
  game.run('for(let i=1;i<=90;i++)frame(1000+i*16);update(.5);');
  assert.equal(game.run(snapshot),before,'abilities pause player/enemy timers, health, mana, projectiles and pickups');
  game.dispatch('document','keydown',{code:'KeyM'});
  assert.equal(game.run('infoView'),'map');
  game.run('for(let i=1;i<=90;i++)frame(2440+i*16);frame(61000);update(.5);');
  assert.equal(game.run(snapshot),before,'switching to map must keep the entire simulation frozen');
  assert.equal(game.run('last'),61000,'the animation clock must keep advancing during inspection');
  game.dispatch('document','keydown',{code:'KeyM'});
  assert.equal(game.run('infoView'),null);
  game.run('frame(61016);');
  assert.ok(Math.abs(game.run('p.time')-3.016)<1e-9,'closing the view must not simulate the paused interval');
  assert.ok(Math.abs(game.run('enemies[0].wind')-.284)<1e-9);
  assert.ok(Math.abs(game.run('shots[0].life')-2.984)<1e-9);
  assert.ok(game.run('shots[0].x')<13.5);
  assert.ok(game.run('pshots[0].x')>17.5);
  assert.ok(game.run('p.hp')>72);
  assert.ok(game.run('p.mana')>42);
});

test('inspection clears queued actions and ignores gameplay inputs until the view is closed',()=>{
  const game=arena();
  game.dispatch('document','keydown',{code:'KeyW'});
  game.dispatch('document','keydown',{code:'ShiftLeft'});
  game.dispatch('document','keydown',{code:'KeyF'});
  game.dispatch('document','keydown',{code:'KeyE'});
  game.dispatch('c','mousedown',{button:0});
  game.dispatch('c','mousedown',{button:2});
  assert.equal(game.run(pending),true);
  game.dispatch('document','keydown',{code:'Tab'});
  assert.equal(game.run(pending),false,'opening the record clears movement, attacks and one-shot requests');
  const before=game.run(snapshot);
  for(const code of ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ShiftLeft','Space','KeyF','KeyE','KeyQ','Digit6']){
    game.dispatch('document','keydown',{code});
  }
  game.dispatch('document','keydown',{code:'KeyW',repeat:true});
  game.dispatch('document','mousemove',{movementX:50,movementY:-30});
  game.dispatch('document','wheel',{deltaY:1});
  game.dispatch('document','wheel',{deltaY:-1});
  game.dispatch('c','mousedown',{button:0});
  game.dispatch('c','mousedown',{button:2});
  assert.equal(game.run(snapshot),before,'camera, weapon, player and combat state stay unchanged');
  assert.equal(game.run(pending),false,'ignored inputs must not fire after resuming');
  game.dispatch('document','keydown',{code:'KeyM'});
  game.dispatch('document','keydown',{code:'KeyM'});
  assert.equal(game.run('infoView'),null);
  assert.equal(game.run(pending),false);
  game.run('frame(1016);');
  assert.equal(game.run('p.x'),10.5,'closing the view does not replay held movement');
  game.dispatch('document','keydown',{code:'KeyW'});
  game.dispatch('document','keydown',{code:'Digit3'});
  game.dispatch('document','mousemove',{movementX:10,movementY:0});
  game.run('frame(1032);');
  assert.ok(game.run('p.x')>10.5,'fresh movement input works after closing');
  assert.equal(game.run('p.w'),2,'fresh weapon input works after closing');
  assert.ok(game.run('p.a')>0,'fresh camera input works after closing');
});
