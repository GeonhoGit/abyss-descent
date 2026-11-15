'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

function arena() {
  const game = loadGame();
  game.run(`
    p=newPlayer();p.x=10;p.y=10;p.a=0;
    state='play';floorN=1;map.fill(0);
    enemies=[];shots=[];pshots=[];items=[];fxs=[];parts=[];dnums=[];msgs=[];
    portal={x:30,y:30,open:false};boss=null;bossFloor=false;needK=99;
  `);
  return game;
}

test('검으로 막은 탄환은 같은 프레임에 플레이어에게 피해를 주지 않는다', () => {
  const game = arena();
  game.run(`
    shots.push({x:10.8,y:10,vx:-11,vy:0,life:6,dmg:10,tex:SP.arrow});
    swordHit(false);
  `);
  assert.equal(game.run('shots[0].life'), 0);
  game.run('update(.05)');
  assert.equal(game.run('p.hp'), 100);
  assert.equal(game.run('shots.length'), 0);
});

test('충격파로 지운 탄환은 같은 프레임에 피해를 주지 않는다', () => {
  const game = arena();
  game.run(`
    p.m.shock=1;shockReq=true;
    shots.push({x:10.8,y:10,vx:-11,vy:0,life:6,dmg:10,tex:SP.arrow});
    update(.05);
  `);
  assert.equal(game.run('p.hp'), 100);
  assert.equal(game.run('shots.length'), 0);
});

test('벽 뒤의 적은 폭발에 피해를 받지 않고 보이는 적은 피해를 받는다', () => {
  const game = arena();
  game.run(`
    map[10*MS+11]=1;
    const hiddenTarget=spawnEnemy('ogre',12.1,10.5);
    const visibleTarget=spawnEnemy('ogre',10.5,12.1);
  `);
  assert.equal(game.run('los(10.5,10.5,hiddenTarget.x,hiddenTarget.y)'), false);
  assert.equal(game.run('los(10.5,10.5,visibleTarget.x,visibleTarget.y)'), true);
  game.run("explode(10.5,10.5,2,55,'player')");
  assert.equal(game.run('hiddenTarget.hp'), 200);
  assert.equal(game.run('visibleTarget.hp'), 145);
});

test('정상 탄환은 실제 update에서 플레이어에게 피해를 준다', () => {
  const game = arena();
  game.run(`
    shots.push({x:10.8,y:10,vx:-11,vy:0,life:6,dmg:10,tex:SP.arrow});
    update(.05);
  `);
  assert.equal(game.run('p.hp'), 90);
  assert.equal(game.run('shots.length'), 0);
});

test('벽에 붙어 지팡이를 발사해도 불덩이가 벽 안에서 생성되지 않는다', () => {
  const game = arena();
  game.run(`
    p.x=10.7;p.y=10.5;p.w=5;p.has[5]=true;
    map[10*MS+11]=1;
    const targetBehindWall=spawnEnemy('ogre',12.2,10.5);
    attack();
  `);
  assert.equal(game.run('solid(pshots[0].x,pshots[0].y)'), false);
  game.run('update(.05)');
  assert.equal(game.run('targetBehindWall.hp'), 200);
  assert.equal(game.run('pshots.length'), 0);
});
