import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canon} from '../public/canon.js';
import {Concert} from '../public/concert.js';

test('完整卡農的低音、三次聲部進場、連結線與第 57 小節終止和弦',()=>{
  assert.equal(canon.beats,57*4);
  const parts=[0,1,2,3].map(voice=>canon.events.filter(e=>e.voice===voice));
  assert.deepEqual(parts.map(part=>part[0].beat),[0,8,16,24]);
  for(let start=0;start<224;start+=8){
    assert.deepEqual(parts[0].filter(n=>n.beat>=start&&n.beat<start+8).map(n=>n.midi),
      [50,45,47,42,43,38,43,45]);
  }
  const subject=(part,start)=>part.filter(n=>n.beat<start+200)
    .map(n=>[n.beat-start,n.midi,n.duration]);
  assert.deepEqual(subject(parts[1],8),subject(parts[2],16));
  assert.deepEqual(subject(parts[1],8),subject(parts[3],24));
  assert.deepEqual(parts.map(p=>[p.at(-1).beat,p.at(-1).midi]),[[224,50],[224,69],[224,78],[224,74]]);
  assert.equal(parts[1].find(n=>n.beat===46*4+3.5).duration,1);
});

test('全曲每個音均交給音訊及動畫，播放到最後一小節',()=>{
  const concert=new Concert(canon,0),audio=[],visual=[];
  for(let time=0;time<=concert.duration;time+=.045){
    concert.schedule(time,n=>audio.push(n));
    concert.advance(time,n=>visual.push(n));
  }
  assert.equal(concert.notes.length,1956);
  assert.deepEqual(audio,concert.notes);
  assert.deepEqual(visual,concert.notes);
});
