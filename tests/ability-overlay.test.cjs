'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');

function playing(){
  const game=loadGame();
  game.run("p=newPlayer();state='play';locked=true;enemies=[];items=[];msgs=[];boss=null;prompt='';");
  return game;
}

function capture(game,draw='drawHUD(ctx)'){
  return JSON.parse(game.run(`
    var overlayText=[],overlayRects=[],oldText=ctx.fillText,oldRect=ctx.fillRect;
    ctx.fillText=(text,x,y)=>overlayText.push({text:String(text),x,y});
    ctx.fillRect=(x,y,w,h)=>overlayRects.push([x,y,w,h]);
    try{${draw};}finally{ctx.fillText=oldText;ctx.fillRect=oldRect;}
    JSON.stringify({text:overlayText,rects:overlayRects});
  `));
}

const showsMap=result=>result.rects.some(r=>r[0]===0&&r[1]===0&&r[2]===480&&r[3]===270);
const showsName=(result,name)=>result.text.some(t=>t.text===name);

test('Tab and M toggle their views and switch directly between abilities and map',()=>{
  const game=playing();
  game.run('p.ups.sword=2;');
  assert.equal(showsName(capture(game),'날카로운 칼날'),false);
  const tab=game.dispatch('document','keydown',{code:'Tab'});
  assert.equal(tab.defaultPrevented,true);
  assert.equal(showsName(capture(game),'날카로운 칼날'),true);
  assert.equal(showsMap(capture(game,'drawMiniMap(ctx)')),false);
  game.dispatch('document','keyup',{code:'Tab'});
  assert.equal(showsName(capture(game),'날카로운 칼날'),true,'releasing Tab keeps the record open');
  game.dispatch('document','keydown',{code:'Tab',repeat:true});
  assert.equal(showsName(capture(game),'날카로운 칼날'),true);
  game.dispatch('document','keydown',{code:'KeyM'});
  assert.equal(showsName(capture(game),'날카로운 칼날'),false);
  assert.equal(showsMap(capture(game,'drawMiniMap(ctx)')),true,'M switches directly from abilities to map');
  game.dispatch('document','keyup',{code:'KeyM'});
  assert.equal(showsMap(capture(game,'drawMiniMap(ctx)')),true,'releasing M keeps the map open');
  game.dispatch('document','keydown',{code:'KeyM',repeat:true});
  assert.equal(showsMap(capture(game,'drawMiniMap(ctx)')),true);
  game.dispatch('document','keydown',{code:'Tab'});
  assert.equal(showsName(capture(game),'날카로운 칼날'),true,'Tab switches directly from map to abilities');
  assert.equal(showsMap(capture(game,'drawMiniMap(ctx)')),false);
  game.dispatch('document','keydown',{code:'Tab'});
  assert.equal(showsName(capture(game),'날카로운 칼날'),false,'a second Tab press closes the record');
  game.dispatch('document','keydown',{code:'KeyM'});
  assert.equal(showsMap(capture(game,'drawMiniMap(ctx)')),true);
  game.dispatch('document','keydown',{code:'KeyM'});
  assert.equal(showsMap(capture(game,'drawMiniMap(ctx)')),false);
});

test('losing focus closes both inspection views and keeps menu Tab navigation intact',()=>{
  const game=playing();
  game.run('p.ups.sword=1;lock();');
  for(const code of ['Tab','KeyM'])for(const event of ['blur','pointerlockchange']){
    game.run('lock();');
    game.dispatch('document','keydown',{code});
    game.dispatch('document','keyup',{code});
    assert.equal(game.run('infoView'),code==='Tab'?'abilities':'map');
    if(event==='blur')game.dispatch('window','blur');
    else{game.document.pointerLockElement=null;game.dispatch('document','pointerlockchange');}
    assert.equal(game.run('infoView'),null);
    assert.equal(game.run('!!(keys.Tab||keys.KeyM)'),false);
    assert.equal(showsName(capture(game),'날카로운 칼날'),false);
    assert.equal(showsMap(capture(game,'drawMiniMap(ctx)')),false);
  }
  for(const code of ['Tab','KeyM']){
    game.run('lock();');
    game.dispatch('document','keydown',{code});
    assert.equal(game.run('infoView'),code==='Tab'?'abilities':'map');
    game.run('startGame();');
    assert.equal(game.run('infoView'),null,'a new run closes the previous information view');
  }
  game.run("panel='settings';");
  assert.equal(game.dispatch('document','keydown',{code:'Tab'}).defaultPrevented,false);
});

test('the ability record follows actual selections and merges repeat upgrades by level',()=>{
  const game=playing();
  assert.deepEqual(JSON.parse(game.run('JSON.stringify(getOwnedUpgrades())')),[]);
  game.run(`
    for(const id of ['sword','sword','shock','heal']){
      state='upgrade';curChoices=[UPG.find(u=>u.id===id)];chooseUpg(0);
    }
    p.ups.spd=0;p.ups.unknown=5;
  `);
  const owned=JSON.parse(game.run('JSON.stringify(getOwnedUpgrades())'));
  assert.equal(owned.length,3);
  assert.deepEqual(owned.map(u=>u.id),['sword','shock','heal']);
  assert.deepEqual(owned.map(u=>u.level),[2,1,1]);
  assert.deepEqual(owned.map(u=>u.kind),['upgrade','ability','consumable']);
  assert.match(owned[0].effect,/60/,'two sword upgrades should describe their combined effect');
  assert.match(owned[1].effect,/55/,'level-one shock should describe its current damage');
  assert.ok(owned.every(u=>typeof u.effect==='string'&&u.effect.length>0));
  assert.equal(game.run('p.m.sword'),1.6);
});

test('empty and fully acquired records render without losing any of the 19 ability names',()=>{
  const game=playing();
  game.dispatch('document','keydown',{code:'Tab'});
  const empty=capture(game);
  assert.ok(empty.text.some(t=>/아직|없습니다|없음/.test(t.text)),'an empty run needs a clear empty state');
  game.run('for(const u of UPG){u.f();p.ups[u.id]=1;}');
  const all=capture(game);
  const names=JSON.parse(game.run('JSON.stringify(UPG.map(u=>u.n))'));
  assert.equal(names.length,19);
  for(const name of names){
    assert.equal(showsName(all,name),true,name+' must appear in the ability record');
    const text=all.text.find(t=>t.text===name);
    assert.ok(text.x>=0&&text.x<480&&text.y>0&&text.y<270,name+' must remain inside the viewport');
  }
});
