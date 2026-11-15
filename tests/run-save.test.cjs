'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');
const RUN='abyss_run_v1',META='abyss_save_v2';
const snapshot=game=>JSON.parse(game.run('JSON.stringify(captureRun())'));
const withoutTime=data=>{delete data.savedAt;return data;};
function fresh(options={}){const game=loadGame(options);game.run('startGame()');return game;}

test('a fresh app resumes the same dungeon, boss, player, items and in-flight projectiles',()=>{
  const game=fresh({savedData:{souls:84,best:9,meta:{vigor:2}}});
  game.run(`
    floorN=5;genLevel();p.gold=123;p.hp=51;p.mana=37;p.has=[true,true,true,true,true,true];p.w=4;p.ammo={b:87,s:11};
    UPG.find(u=>u.id==='shock').f();p.ups.shock=1;UPG.find(u=>u.id==='armor').f();p.ups.armor=1;
    boss.awake=true;boss.hp-=123;boss.wind=.21;boss.wk='melee';
    enemyShot(boss,.5,17,SP.orbG,6.5);
    pshots.push({x:p.x,y:p.y,vx:5,vy:0,life:1.7,dmg:91});
    seen[Math.floor(p.y)*MS+Math.floor(p.x)]=1;
    items.push({type:'coin',x:p.x,y:p.y,val:13});
  `);
  assert.equal(game.run('saveRun()'),true);
  const expected=withoutTime(snapshot(game));
  const next=loadGame({sharedStorage:game.storage});
  assert.equal(next.element('continueBtn').classList.contains('hidden'),false);
  assert.match(next.element('runSaveLine').textContent,/지하 5층/);
  assert.equal(next.run('resumeRun()'),true);
  assert.deepEqual(withoutTime(snapshot(next)),expected);
  assert.equal(next.run('shots[0].tex===SP.orbG&&boss===enemies.find(e=>e.type===boss.type)'),true);
  assert.equal(next.run('save.souls'),84,'resuming does not award or spend permanent souls');
  assert.equal(next.run('locked&&state==="play"'),true);
});

test('shop stock keeps sold flags and restores working purchase effects without rerolling',()=>{
  const game=fresh();game.run('p.gold=500;p.has[1]=true;p.ammo.b=80;openShop();');
  game.element('shopList').children[0].children[0].children[0].dispatchEvent({type:'click'});
  const saved=JSON.parse(game.storage.get(RUN));
  assert.equal(saved.stock[0].sold,true);
  const next=loadGame({sharedStorage:game.storage});assert.equal(next.run('resumeRun()'),true);
  assert.equal(next.run('state'),'shop');
  assert.deepEqual(snapshot(next).stock,saved.stock);
  const tome=next.run('shopStock.findIndex(it=>it.kind==="tome")');
  const id=next.run(`shopStock[${tome}].art`),cost=next.run(`shopStock[${tome}].cost`),gold=next.run('p.gold');
  next.element('shopList').children[tome].children[0].children[0].dispatchEvent({type:'click'});
  assert.equal(next.run('p.gold'),gold-cost);
  assert.equal(next.run(`p.ups['${id}']`),1);
  next.element('shopList').children[tome].children[0].children[0].dispatchEvent({type:'click'});
  assert.equal(next.run('p.gold'),gold-cost,'a sold item cannot charge the player again');
  assert.equal(JSON.parse(next.storage.get(RUN)).stock[tome].sold,true);
  next.run('closeShop()');assert.equal(JSON.parse(next.storage.get(RUN)).mode,'play');
});

test('pending level-up choices and the victory screen survive restarting the app',()=>{
  const game=fresh();game.run('p.xp=needXp();levelUp();');
  const choices=game.run('JSON.stringify(curChoices.map(u=>u.id))');
  const next=loadGame({sharedStorage:game.storage});assert.equal(next.run('resumeRun()'),true);
  assert.equal(next.run('state'),'upgrade');assert.equal(next.run('JSON.stringify(curChoices.map(u=>u.id))'),choices);
  const id=next.run('curChoices[0].id');next.run('chooseUpg(0)');assert.equal(next.run(`p.ups['${id}']`),1);
  assert.equal(JSON.parse(next.storage.get(RUN)).mode,'play');
  next.run('floorN=15;genLevel();boss.dead=true;boss.hp=0;portal.open=true;enterPortal();');
  assert.equal(JSON.parse(next.storage.get(RUN)).mode,'win');
  const won=loadGame({sharedStorage:next.storage});assert.equal(won.run('resumeRun()'),true);
  assert.equal(won.run('state'),'win');assert.match(won.element('winStat').innerHTML,/군주가 무너졌습니다/);
  assert.equal(won.run('p.won&&!p.ended&&!locked'),true);
});

test('malformed run saves are rejected before touching the current game or permanent progress',()=>{
  const game=fresh({savedData:{souls:55,meta:{vigor:1}}});const valid=snapshot(game);
  const before=game.run('JSON.stringify({p,floorN,map:Array.from(map),save})');
  const corruptions=[
    d=>d.version=99,d=>d.player.hp=0,d=>d.player.hp=Infinity,d=>d.player.m.rate=0,
    d=>d.player.has[1]='yes',d=>delete d.player.gunMotion,d=>d.player.x=0,d=>d.player.m.orbit=99999,
    d=>d.map[0]=0,d=>d.map.pop(),d=>d.rooms[0].w=10000,d=>d.player.ups.fake=1,
    d=>d.enemies[0].type='missing',d=>d.bossIndex=999,d=>d.portal.cx=-1,
    d=>d.shots=[{x:2,y:2,vx:1,vy:0,life:1,dmg:1,texId:'missing'}],
    d=>{d.mode='upgrade';d.choices=[];},d=>d.stock=[{kind:'weapon',art:'unknown',cost:1,sold:false}],
    d=>d.player.ended=true,d=>d.extra={constructor:{bad:true}}
  ];
  for(const change of corruptions){
    const data=structuredClone(valid);change(data);game.storage.set(RUN,JSON.stringify(data));
    assert.equal(game.run('resumeRun()'),false);assert.equal(game.run('JSON.stringify({p,floorN,map:Array.from(map),save})'),before);
  }
  for(const raw of ['{broken','null','x'.repeat(1500001)]){game.storage.set(RUN,raw);assert.equal(game.run('resumeRun()'),false);}
  assert.equal(game.run('save.souls'),55);
});

test('saving and quitting preserves the run, while finishing deletes it and cannot reward twice',()=>{
  const game=fresh();game.run('p.kills=20;p.gold=91;');
  assert.equal(game.run('suspendRun()'),true);assert.equal(game.run('state'),'title');assert.equal(game.run('save.runs'),0);
  assert.equal(game.run('resumeRun()'),true);assert.equal(game.run('p.gold'),91);
  const stale=game.storage.get(RUN);game.run('gameOver()');
  assert.equal(game.storage.has(RUN),false);const souls=game.run('save.souls');assert.ok(souls>0);
  game.run('endRun();toTitle();');assert.equal(game.run('save.souls'),souls);assert.equal(game.run('save.runs'),1);
  const next=loadGame({savedRun:stale,savedData:game.storage.get(META)});
  assert.equal(next.run('resumeRun()'),false,'a completed run ID cannot be revived from a stale checkpoint');
  assert.equal(next.run('save.souls'),souls);
});

test('write failures keep the current game open and never report a successful save',()=>{
  const first=fresh(),stored=first.storage.get(RUN);
  const game=loadGame({sharedStorage:first.storage,storageError:true});assert.equal(game.run('resumeRun()'),true);
  game.run('p.gold=71;');assert.equal(game.run('suspendRun()'),false);
  assert.equal(game.run('state'),'play');assert.equal(game.run('p.gold'),71);assert.equal(game.run('p.ended'),false);
  assert.equal(game.storage.get(RUN),stored);assert.match(game.element('saveStatus').textContent,/저장하지 못했습니다/);
});

test('five-second autosaves and page-hide checkpoints work while previews leave storage untouched',()=>{
  const game=fresh(),stored=game.storage.get(RUN);
  game.run('p.gold=17;autosaveRun(4.9)');assert.equal(game.storage.get(RUN),stored);
  game.run('autosaveRun(.1)');assert.equal(JSON.parse(game.storage.get(RUN)).player.gold,17);
  game.run('p.gold=21');game.dispatch('window','pagehide');assert.equal(JSON.parse(game.storage.get(RUN)).player.gold,21);
  const preview=loadGame({sharedStorage:game.storage,runSaveEnabled:false});const before=[...preview.storage];
  assert.equal(preview.run('readRun()'),null);preview.run('startGame();p.gold=99;autosaveRun(10);');
  assert.equal(preview.run('saveRun()'),false);assert.deepEqual([...preview.storage],before);
});

test('real boss drops with optional values and tiny positive health remain resumable',()=>{
  const game=fresh();game.run("floorN=5;genLevel();killEnemy(boss,'sword');p.hp=.00001;");
  assert.equal(game.run('items.some(it=>it.type==="hp"&&it.val===undefined)'),true);
  assert.equal(game.run('saveRun()'),true);
  const expected=withoutTime(snapshot(game));
  const next=loadGame({sharedStorage:game.storage});assert.equal(next.run('resumeRun()'),true);
  assert.equal(next.run('p.hp'),.00001);assert.equal(next.run('boss.dead'),true);
  // JSON serialization intentionally omits optional undefined drop values.
  assert.deepEqual(withoutTime(snapshot(next)),expected);
});

test('a previously offered tome cannot exceed its upgrade cap after a later level-up',()=>{
  const game=fresh();game.run(`
    p.gold=500;
    for(let i=0;i<4;i++)UPG.find(u=>u.id==='spd').f();p.ups.spd=4;
    shopStock=[restoreStock({kind:'tome',art:'spd',cost:86,sold:false})];openShop();
  `);
  const staleButton=game.element('shopList').children[0].children[0].children[0];
  assert.equal(staleButton.disabled,false);
  game.run("closeShop();state='upgrade';curChoices=[UPG.find(u=>u.id==='spd')];chooseUpg(0);openShop();");
  const rows=game.element('shopList').children,last=rows[rows.length-1].children[0].children[0];
  assert.equal(last.disabled,true);assert.match(last.innerHTML,/최대 강화/);
  const before=game.run('JSON.stringify({gold:p.gold,rank:p.ups.spd,spd:p.m.spd})');
  staleButton.dispatchEvent({type:'click'});last.dispatchEvent({type:'click'});
  assert.equal(game.run('JSON.stringify({gold:p.gold,rank:p.ups.spd,spd:p.m.spd})'),before);
  assert.equal(game.run('p.ups.spd'),5);assert.equal(game.run('saveRun()'),true);
});

test('failed permanent-reward writes preserve the checkpoint and roll back uncommitted souls',()=>{
  const game=fresh({savedData:{souls:20,runs:3},storageError:(op,key)=>op==='set'&&key===META});
  game.run('p.kills=20;p.gold=44;saveRun();');const checkpoint=game.storage.get(RUN),meta=game.storage.get(META);
  game.run('gameOver();');assert.equal(game.storage.get(RUN),checkpoint,'a successful remove must not run after a failed reward write');
  assert.equal(game.storage.get(META),meta);assert.equal(game.run('save.souls'),20);assert.equal(game.run('save.runs'),3);
  assert.equal(game.run('save.lastEndedRun'),undefined);assert.match(game.element('overStat').innerHTML,/영혼 정산을 저장하지 못했습니다/);
  game.run('toTitle();');assert.equal(game.storage.get(RUN),checkpoint);assert.match(game.element('runSaveLine').textContent,/삭제하지 않았습니다/);
  const recovered=loadGame({sharedStorage:game.storage});assert.equal(recovered.run('resumeRun()'),true);
  assert.equal(recovered.run('p.gold'),44);assert.equal(recovered.run('save.souls'),20);
});
