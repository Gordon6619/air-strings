import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Crossing,parseScene,tone,metric,projection,closestEnd,config} from '../public/core.js';
import {Gestures,Tracker} from '../public/gesture.js';
const pt=(x,y)=>({x,y});
const layout=(aspect=1)=>parseScene({aspect,schemaVersion:1,tuning:'free',strings:[]});
function wire(y,id='s1'){return {id,createdSeq:1,a:pt(.15,y),b:pt(.85,y)}}
test('等長音高、兩倍頻率、十二平均律與範圍',()=>{
  for(const aspect of [16/9,4/3,1,3/4]){
    const s=layout(aspect),m=metric(pt(1,1),aspect);
    for(const [x,y] of [[1,0],[0,1],[.6,.8]])for(const [len,hz] of [[.5,220],[.25,440]]){
      assert.ok(Math.abs(tone(pt(0,0),pt(x*len/m.x,y*len/m.y),s).hz-hz)<1e-8);
    }
  }
  const s=layout();assert.equal(tone(pt(0,0),pt(.01,0),s).hz,880);
  s.tuning='chromatic';assert.equal(tone(pt(0,0),pt(.501,0),s).hz,220);
});
test('同幀快速掃過三弦，依路徑順序發聲',()=>{
  const s=layout();s.strings=[wire(.7,'bottom'),wire(.3,'top'),wire(.5,'mid')];
  const c=new Crossing();c.sample('a',pt(.5,.2),0,s);
  const hits=c.sample('a',pt(.5,.8),40,s);
  assert.deepEqual(hits.map(e=>e.stringId),['top','mid','bottom']);
  assert.ok(hits.every(e=>Math.abs(e.position01-.5)<1e-8));
});
test('慢撥穿越遲滯帶仍只發一音，兩手各自冷卻',()=>{
  const s=layout();s.strings=[wire(.5)];const c=new Crossing();
  const ys=[.481,.487,.493,.499,.505,.511,.512,.504,.501,.498,.501];
  for(const hand of ['left','right'])assert.equal(ys.flatMap((y,i)=>c.sample(hand,pt(.5,y),i*30,s)).length,1);
});
test('平行、延長線、端點、停留、過慢穿越、失追及倒序皆安靜',()=>{
  const s=layout();s.strings=[wire(.5)];
  for(const [p,q,dt] of [[pt(.3,.48),pt(.7,.48),40],[pt(.93,.4),pt(.93,.6),40],[pt(.16,.4),pt(.16,.6),40],[pt(.5,.5),pt(.5,.5),40],[pt(.5,.4),pt(.5,.6),101],[pt(.5,.4),pt(.5,.6),-2]]){
    const c=new Crossing();c.sample('a',p,20,s);assert.equal(c.sample('a',q,20+dt,s).length,0);
  }
  const c=new Crossing();let num=0;for(let i=0;i<=40;i++)num+=c.sample('a',pt(.5,.48+i*.001),i*25,s).length;assert.equal(num,0);
});
test('鏡像後交點、交點相對位置與頻率相同',()=>{
  const mirror=p=>pt(1-p.x,p.y);const s=layout(16/9);
  for(const reflect of [p=>p,mirror]){
    s.strings=[{...wire(.5),a:reflect(pt(.15,.45)),b:reflect(pt(.85,.55))}];
    const c=new Crossing();c.sample('a',reflect(pt(.5,.4)),0,s);
    const [hit]=c.sample('a',reflect(pt(.5,.6)),30,s);assert.ok(Math.abs(hit.position01-.5)<1e-9);
  }
});
test('場景增刪改、8 弦上限、復原清場、格式不符不覆寫',()=>{
  const s=new Scene();for(let i=0;i<8;i++)assert.ok(s.commit(pt(.1,.1+i*.1),pt(.8,.1+i*.1)));
  assert.ok(!s.commit(pt(.1,.1),pt(.9,.9)));const before=structuredClone(s.data);
  s.clear();s.undo();assert.deepEqual(s.data,before);const id=s.data.strings[0].id;
  s.remove(id);s.undo();assert.deepEqual(s.data,before);
  assert.ok(s.commit(pt(.11,.1),pt(.5,.1),id));s.undo();assert.deepEqual(s.data,before);
  for(const invalid of [{...before,schemaVersion:2},{...before,strings:[{...wire(.5),b:pt(NaN,1)}]},{...before,strings:[{...wire(.5),b:pt(1,2)}]},{...before,strings:[{...wire(.5),b:pt(.15,.5)}]}])assert.throws(()=>s.load(invalid));
  assert.deepEqual(s.data,before);
  assert.equal(parseScene({schemaVersion:1,strings:[]}).referenceHz,220);
});
function palm(x,y,closed=false){const p=Array.from({length:21},()=>pt(x,y));
  p[5]=pt(x-.04,y+.1);p[17]=pt(x+.04,y+.1);p[8]=pt(x,y);p[4]=pt(x+(closed?.008:.065),y);return p;}
function actor(scene){
  const g=new Gestures(scene);let time=0;const events=[];
  function frames(reps,hands){for(let i=0;i<reps;i++){time+=20;events.push(...g.update(time,hands.map(([id,x,y,closed])=>({id,points:palm(x,y,closed)}))))}}
  return {g,frames,events};
}
test('雙手建弦、同時放開單次提交、無意外撥音、單手可調端點',()=>{
  const s=new Scene();s.load(layout());const {g,frames,events}=actor(s);
  frames(4,[['a',.2,.45,false],['b',.75,.45,false]]);
  frames(6,[['a',.2,.45,true],['b',.75,.45,true]]);assert.ok(g.draft);
  frames(5,[['a',.2,.45,false],['b',.75,.45,false]]);
  assert.equal(s.data.strings.length,1);const initial=structuredClone(s.data.strings[0]);
  frames(6,[['a',.2,.45,true]]);assert.equal(g.draft?.id,initial.id);
  frames(4,[['a',.35,.45,true]]);frames(5,[['a',.35,.45,false]]);
  assert.ok(s.data.strings[0].a.x>initial.a.x+.1);assert.deepEqual(s.data.strings[0].b,initial.b);assert.equal(events.length,0);
});
test('一手持續捏住新弦，另一手撥中移動後的弦，只響一次且採用當下音高',()=>{
  const scene=new Scene();scene.load(layout());const {g,frames,events}=actor(scene);
  const pair=(rightX,closed,y)=>[['left',.2,y,closed],['right',rightX,.45,true]];
  frames(4,[['left',.2,.45,false],['right',.75,.45,false]]);
  frames(6,pair(.75,true,.45));frames(6,pair(.75,false,.45));
  assert.equal(g.draft?.end,'b');assert.equal(scene.data.strings.length,1);
  frames(3,[['left',.48,.38,false],['right',.65,.45,true]]);
  frames(1,[['left',.48,.52,false],['right',.65,.45,true]]);
  assert.equal(events.length,1);assert.equal(events[0].trackId,'left');
  assert.equal(events[0].frequencyHz,tone(g.draft.a,g.draft.b,scene.data).hz);
  frames(5,[['left',.48,.52,false],['right',.65,.45,false]]);
  assert.equal(g.draft,null);assert.equal(events.length,1);
});
test('移動琴弦穿過靜止的手指時不觸發撥弦',()=>{
  const s=layout();const c=new Crossing(),p=pt(.5,.5);
  for(const [i,y] of [.42,.44,.48,.51,.56].entries()){
    s.strings=[wire(y)];
    assert.equal(c.sample('free',p,20*i,s,s.strings[0].id).length,0);
  }
});
test('失追取消尚未提交的端點，重新進畫面不誤撥',()=>{
  const s=new Scene();s.load({...layout(),strings:[wire(.5)]});const before=structuredClone(s.data);
  const {g,frames,events}=actor(s);frames(4,[['a',.15,.5,false]]);frames(6,[['a',.15,.5,true]]);assert.ok(g.draft);
  frames(1,[['a',.28,.46,true]]);frames(18,[]);assert.equal(g.draft,null);frames(4,[['new',.6,.8,false]]);
  assert.deepEqual(s.data,before);assert.equal(events.length,0);
});
test('建立太短的弦、配對超時均不提交',()=>{
  const s=new Scene();s.load(layout());const {frames,g}=actor(s);
  frames(4,[['a',.2,.4,false],['b',.26,.4,false]]);frames(6,[['a',.2,.4,true],['b',.26,.4,true]]);
  frames(6,[['a',.2,.4,false],['b',.26,.4,false]]);assert.equal(s.data.strings.length,0);
  frames(25,[['a',.2,.4,true],['b',.7,.4,false]]);frames(6,[['a',.2,.4,true],['b',.7,.4,true]]);assert.equal(g.draft,null);
});
test('雙手回報順序反轉時保留 ID，兩手重疊捨棄不確定位置',()=>{
  const t=new Tracker();const initial=t.match([palm(.2,.5),palm(.8,.5)],0,1);
  const next=t.match([palm(.78,.5),palm(.22,.5)],30,1);
  assert.equal(initial[0].id,next[1].id);assert.equal(initial[1].id,next[0].id);
  assert.deepEqual(t.match([palm(.49,.5),palm(.51,.5)],60,1),[]);
});
test('同一回放輸出完全相同，端點重疊時選先建立的弦',()=>{
  const s=layout();s.strings=[wire(.5,'first'),wire(.5,'second')];
  assert.equal(closestEnd(pt(.15,.5),s).id,'first');
  const replay=()=>{const c=new Crossing();return [.4,.46,.51,.6,.6,.4].flatMap((y,i)=>c.sample('hand',pt(.54,y),i*40,s))};
  assert.deepEqual(replay(),replay());
});
