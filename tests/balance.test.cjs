'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);

function arena(){
  const game=loadGame();
  game.run(`
    p=newPlayer();p.x=10;p.y=10;p.a=0;p.m.crit=0;state='play';floorN=1;map.fill(0);
    enemies=[];items=[];shots=[];pshots=[];fxs=[];parts=[];dnums=[];msgs=[];
    portal={x:30,y:30,cx:30,cy:30,open:false};boss=null;bossFloor=false;needK=999;
    Math.random=()=>.5;
  `);
  return game;
}

test('SMG trades ammo efficiency for burst damage without wasting the shared bullet pool',()=>{
  const game=arena();
  const shots=[];
  for(const weapon of [1,3])shots.push(JSON.parse(game.run(`
    enemies=[];var target=spawnEnemy('ogre',12,10);target.hp=1000;
    p.w=${weapon};p.has[p.w]=true;p.ammo.b=100;p.cd=0;attack();
    JSON.stringify({damage:1000-target.hp,cooldown:p.cd,spent:100-p.ammo.b});
  `)));
  const [pistol,smg]=shots;
  assert.equal(pistol.damage,21);assert.equal(smg.damage,12);
  assert.equal(pistol.spent,1);assert.equal(smg.spent,1);
  close(smg.cooldown,.1);
  assert.ok(smg.damage/smg.cooldown>pistol.damage/pistol.cooldown);
  assert.ok(smg.damage>=pistol.damage/2,'burst weapon should retain at least half the damage per bullet');
  assert.ok(smg.damage<pistol.damage,'pistol remains the ammunition-efficient option');
});

test('elite health ramps gently from floor three while normal and boss health stay intact',()=>{
  const game=arena(),samples=[];
  for(const floor of [1,3,4,11,14,30])samples.push(JSON.parse(game.run(`
    enemies=[];floorN=${floor};
    var normal=spawnEnemy('ogre',12,10),elite=spawnEnemy('ogre',14,10,true),royal=spawnEnemy('kslime',16,10);
    JSON.stringify({floor:floorN,normal:normal.maxhp,elite:elite.maxhp,damageRatio:elite.dm/normal.dm,boss:royal.maxhp});
  `)));
  assert.equal(samples[0].normal,200);
  for(const s of samples){close(s.normal,200*(1+.13*(s.floor-1)));close(s.damageRatio,1.3);assert.equal(s.boss,650);}
  close(samples[1].elite/samples[1].normal,1.8);
  close(samples[2].elite/samples[2].normal,1.85);
  assert.ok(samples[2].elite/samples[1].elite<1.2,'the next floor must not cause an elite-health cliff');
  for(const s of samples.slice(3))close(s.elite/s.normal,2.2);
});

test('deep-floor kills reward growth, stack elite rewards, and preserve boss rewards',()=>{
  const game=arena();
  function reward(floor,type,elite=false){return JSON.parse(game.run(`
    p=newPlayer();floorN=${floor};enemies=[];items=[];fxs=[];parts=[];dnums=[];portal.open=false;
    var foe=spawnEnemy('${type}',12,10,${elite});killEnemy(foe,'sword');
    JSON.stringify({xp:p.xp,gold:items.find(i=>i.type==='coin').val});
  `));}
  const first=reward(1,'skel'),deep=reward(11,'skel'),elite=reward(11,'skel',true);
  assert.equal(first.xp,8);close(deep.xp,first.xp*1.3);close(deep.gold,first.gold*1.3);
  close(elite.xp,deep.xp*3);close(elite.gold,deep.gold*3);
  assert.deepEqual(reward(15,'kslime'),reward(5,'kslime'));
});

test('a new first-floor run finds its guaranteed pistol chest in the nearest reachable room',()=>{
  let seed=1;
  const game=loadGame({random:()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)});
  const distances=[];
  for(let i=1;i<=20;i++){
    seed=i*241+1;
    const s=JSON.parse(game.run(`
      p=newPlayer();floorN=1;genLevel();bfs(Math.floor(p.x),Math.floor(p.y));
      var first=items.find(i=>i.type==='chest');
      var room=rooms.find(r=>first.x>=r.x&&first.x<r.x+r.w&&first.y>=r.y&&first.y<r.y+r.h);
      var candidates=rooms.filter(r=>r!==exitRoom&&!(p.x>=r.x&&p.x<r.x+r.w&&p.y>=r.y&&p.y<r.y+r.h));
      var result={distance:flow[(first.y|0)*MS+(first.x|0)],roomDistance:flow[room.cy*MS+room.cx],
        nearest:Math.min(...candidates.map(r=>flow[r.cy*MS+r.cx]).filter(d=>d>=0))};
      openChest(first);result.pistol=p.has[1];result.bullets=p.ammo.b;
      JSON.stringify(result);
    `));
    assert.ok(s.distance>=4);assert.equal(s.roomDistance,s.nearest);
    assert.equal(s.pistol,true);assert.equal(s.bullets,40);distances.push(s.distance);
  }
  assert.ok(distances.reduce((a,b)=>a+b,0)/distances.length<25,'initial weapon should not require a long floor-wide search');
  assert.ok(Math.max(...distances)<40);
});
