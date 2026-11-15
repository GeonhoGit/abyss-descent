'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

function gunGame(weapon = 1) {
  const game = loadGame();
  game.run(`
    p=newPlayer();p.x=20;p.y=20;p.w=${weapon};p.has.fill(true);p.ammo={b:240,s:60};
    state='play';map.fill(0);enemies=[];items=[];shots=[];pshots=[];
    portal={x:35,y:35,cx:35,cy:35,open:false};
    function viewTransform(){
      const calls=[];
      const probe=new Proxy(ctx,{get(target,key){
        if(key==='translate'||key==='rotate')return (...args)=>{calls.push({key,args});target[key](...args);};
        return target[key];
      }});
      drawWeapon(probe);
      return {position:calls.find(c=>c.key==='translate').args,angle:calls.find(c=>c.key==='rotate').args[0]};
    }
  `);
  return game;
}

test('a shot begins from the held pose instead of teleporting to maximum recoil', () => {
  for (const weapon of [1, 2, 3]) {
    const game = gunGame(weapon);
    const before = game.run('viewTransform()');
    game.run('attack()');
    const after = game.run('viewTransform()');
    assert.ok(Math.hypot(after.position[0] - before.position[0], after.position[1] - before.position[1]) < .1, `weapon ${weapon} jumps on firing`);
    assert.ok(Math.abs(after.angle - before.angle) < .001);
  }
});

test('stopping movement and entering a dash blend the held gun pose', () => {
  const game = gunGame();
  game.run('keys.KeyW=true;for(let i=0;i<60;i++)update(1/60);p.bob=0;');
  const moving = game.run('viewTransform()');
  game.run('keys.KeyW=false;update(1/240);');
  const stopped = game.run('viewTransform()');
  assert.ok(Math.hypot(stopped.position[0] - moving.position[0], stopped.position[1] - moving.position[1]) < 2);
  game.run('dashReq=true;update(1/240);');
  const dash = game.run('viewTransform()');
  assert.ok(Math.hypot(dash.position[0] - stopped.position[0], dash.position[1] - stopped.position[1]) < 2);
});

test('mouse-look does not instantly drag the gun across the screen', () => {
  const game = gunGame();
  game.run('locked=true;');
  const before = game.run('viewTransform()');
  game.dispatch('document', 'mousemove', { movementX: 160, movementY: -120 });
  const after = game.run('viewTransform()');
  assert.ok(Math.hypot(after.position[0] - before.position[0], after.position[1] - before.position[1]) < .1);
  game.run('update(1/60);');
  const nextFrame = game.run('viewTransform()');
  assert.ok(Math.hypot(nextFrame.position[0] - before.position[0], nextFrame.position[1] - before.position[1]) < 4);
});

test('fast automatic fire remains bounded and settles back to its original pose', () => {
  const game = gunGame(3);
  const held = game.run('viewTransform()');
  game.run('p.m.rate=1.9;mouseL=true;');
  for (let i = 0; i < 180; i++) {
    game.run('update(1/60);');
    const frame = game.run('viewTransform()');
    assert.ok(frame.position.every(Number.isFinite));
    assert.ok(Math.abs(frame.position[0] - held.position[0]) < 18);
    assert.ok(Math.abs(frame.position[1] - held.position[1]) < 22);
  }
  game.run('mouseL=false;for(let i=0;i<120;i++)update(1/60);p.time=0;');
  const settled = game.run('viewTransform()');
  assert.ok(Math.hypot(settled.position[0] - held.position[0], settled.position[1] - held.position[1]) < .2);
  assert.equal(game.run('p.ammo.b<240'), true);
});

test('firearms rest on the center aiming axis without a sideways cant', () => {
  for (const weapon of [1, 2, 3]) {
    const game = gunGame(weapon);
    const pose = game.run('viewTransform()');
    assert.equal(pose.position[0], 240, `weapon ${weapon} must align with the crosshair`);
    assert.equal(pose.angle, 0);
  }
});

test('recoil stays on the aiming axis instead of rolling the whole gun sideways', () => {
  for (const weapon of [1, 2, 3]) {
    const game = gunGame(weapon);
    game.run('attack();for(let i=0;i<12;i++)update(1/240);');
    const pose = game.run('viewTransform()');
    assert.equal(pose.position[0], 240);
    assert.equal(pose.angle, 0);
  }
});
