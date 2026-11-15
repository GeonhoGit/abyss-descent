'use strict';

// Validate real save/continue buttons and the restored Canvas frame in isolated storage.
// node tools/render-resume.cjs <path-to-@napi-rs/canvas>
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createCanvas}=require(process.argv[2]||'@napi-rs/canvas');
const {loadGame}=require('../tests/game-harness.cjs');
const first=loadGame({createCanvas});
first.run(`startGame();p.hp=73;p.gold=84;p.time=20.25;p.w=1;p.has[1]=true;p.ammo.b=64;msgs=[];draw();`);
const before=first.element('c').toBuffer('image/png');
first.dispatch('saveQuitBtn','click');
assert.equal(first.run('state'),'title');
assert.equal(first.element('continueBtn').classList.contains('hidden'),false);
const next=loadGame({createCanvas,sharedStorage:first.storage});
assert.equal(next.element('continueBtn').classList.contains('hidden'),false);
next.dispatch('continueBtn','click');
assert.equal(next.run('state'),'play');
assert.equal(next.run('p.hp'),73);assert.equal(next.run('p.gold'),84);assert.equal(next.run('p.ammo.b'),64);
next.run('msgs=[];draw();');
const after=next.element('c').toBuffer('image/png');
assert.deepEqual(after,before,'A fresh app must render the same saved scene after continuing');
const output=path.join(__dirname,'..','previews','resumed-run.png');
fs.writeFileSync(output,after);
console.log('PASS: save-and-quit and continue button clicks, fresh session, identical restored Canvas frame; '+output);
