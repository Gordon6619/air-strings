import {paintString} from './resonance.js';

// Beat positions and MIDI pitches of original plucked-string arrangements.
function score(id,title,composer,bpm,beatsPerBar,bars,bass,colors) {
  const events = [];
  let beat = 0;
  for (const phrase of bars) {
    for (const item of phrase) {
      const [midi,duration] = Array.isArray(item) ? item : [item,1];
      events.push({beat,midi,lead:true,strength:beat % beatsPerBar === 0 ? .91 : .73});
      beat += duration;
    }
  }
  const beats = beat;
  bass.forEach((bar,index) => {
    for (const [offset,midi,strength=.44] of bar) {
      events.push({beat:index*beatsPerBar+offset,midi,lead:false,strength});
    }
  });
  events.sort((a,b)=>a.beat-b.beat || Number(a.lead)-Number(b.lead));
  return {id,title,composer,bpm,beatsPerBar,beats,events,colors};
}
const ground = [50,45,47,42,43,50,43,45];
const canonBass = Array.from({length:12},(_,bar)=>{
  const first=ground[(2*bar)%8],second=ground[(2*bar+1)%8];
  return [[0,first,.58],[1,first+7,.36],[2,second,.54],[3,second+7,.36]];
});
const canon = score('canon','D 大調卡農','帕海貝爾',84,4,[
  [[78,2],[76,2]],[[74,2],[73,2]],[[71,2],[69,2]],[[71,2],[73,2]],
  [[74,2],[73,2]],[[71,2],[69,2]],[[67,2],[66,2]],[[67,2],[64,2]],
  [62,66,69,67],[66,62,66,64],[62,59,62,69],[67,71,69,67],
  [[66,2],[62,2]]
],[...canonBass,[[0,50,.6],[2,57],[2,62]]],['#70f1dc','#71aaff','#eaa7ff']);
const odeBars=[
  [64,64,65,67],[67,65,64,62],[60,60,62,64],[[64,1.5],[62,.5],[62,2]],
  [64,64,65,67],[67,65,64,62],[60,60,62,64],[[62,1.5],[60,.5],[60,2]],
  [62,62,64,60],[62,[64,.5],[65,.5],64,60],[62,[64,.5],[65,.5],64,62],[[60,1],[62,1],[55,2]],
  [64,64,65,67],[67,65,64,62],[60,60,62,64],[[62,1.5],[60,.5],[60,2]]
];
const odeRoots=[48,43,48,43,48,43,48,48,43,48,43,43,48,43,48,48];
const ode=score('ode','歡樂頌','貝多芬',112,4,odeBars,odeRoots.map(n=>[[0,n,.57],[2,n+7]]),['#ffd580','#ff987b','#f9a7df']);
const starBars=[
  [60,60,67,67],[69,69,[67,2]],[65,65,64,64],[62,62,[60,2]],
  [67,67,65,65],[64,64,[62,2]],[67,67,65,65],[64,64,[62,2]],
  [60,60,67,67],[69,69,[67,2]],[65,65,64,64],[62,62,[60,2]]
];
const starChords=[[48,52,55],[53,57,55],[53,57,52],[55,59,48],[48,52,53],[48,52,55],
  [48,52,53],[48,52,55],[48,52,55],[53,57,55],[53,57,52],[55,59,48]];
const star=score('star','小星星','法國傳統旋律',100,4,starBars,starChords.map(([a,b,c])=>[[0,a],[1.5,b,.34],[2,c,.48]]),['#99d9ff','#b4a4ff','#ffe5a0']);
export const songs=[canon,ode,star];

function contactPoint(note,px) {
  const a=px(note.wire.a),b=px(note.wire.b);
  return {x:a.x+(b.x-a.x)*note.contact,y:a.y+(b.y-a.y)*note.contact};
}
export function paintConcert(ctx,concert,time,hits,now,px,scale,reduced) {
  const wires=concert.strings;
  ctx.save();
  for(const w of wires){
    const reveal=reduced?1:stringReveal(w.i,wires.length,time);
    if(reveal<=0)continue;
    const a=px(w.a),end=px(w.b),b={x:a.x+(end.x-a.x)*reveal,y:a.y+(end.y-a.y)*reveal};
    const active=hits.active(w.id,now);
    paintString(ctx,a,b,w.color,scale,active,now,reduced);
    ctx.strokeStyle=w.color;ctx.fillStyle=w.color;
    for(const p of [a,b]){
      ctx.globalAlpha=.36;ctx.lineWidth=scale;ctx.beginPath();ctx.arc(p.x,p.y,5.5*scale,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=1;ctx.beginPath();ctx.arc(p.x,p.y,(reveal<1?4:2)*scale,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=.86;ctx.font=Math.max(9,12*scale)+'px monospace';ctx.textAlign='center';
    ctx.fillText(w.name,a.x,a.y-10*scale);ctx.globalAlpha=1;
  }
  const from=concert.previousLead,to=concert.melody[concert.leadIndex];
  if(from&&to&&!reduced) {
    const a=contactPoint(from,px),b=contactPoint(to,px);
    const phase=Math.max(0,Math.min(1,(time-from.time)/(to.time-from.time)));
    function bead(t){
      const eased=t*t*(3-2*t);
      return {x:a.x+(b.x-a.x)*eased,y:a.y+(b.y-a.y)*eased-Math.sin(Math.PI*t)*28*scale};
    }
    for(let i=7;i>=0;i--){
      const p=bead(Math.max(0,phase-i*.018));
      ctx.fillStyle=i?from.wire.color:'#fff9dd';ctx.globalAlpha=i ? .09+(7-i)*.065 : .94;
      ctx.beginPath();ctx.arc(p.x,p.y,(i?2.8:4.1)*scale,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.restore();
}

const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
export function concertStrings(song) {
  const pitches=[...new Set(song.events.map(e=>e.midi))].sort((a,b)=>a-b);
  return pitches.map((midi,i)=>{
    const f=i/Math.max(1,pitches.length-1);
    return {id:'concert-'+midi,midi,i,frequency:440*2**((midi-69)/12),
      name:names[midi%12]+(Math.floor(midi/12)-1),color:song.colors[i%3],
      a:{x:.90-.75*f,y:.16+.35*f*f},b:{x:.86-.79*f,y:.84-.12*f}};
  });
}
export const introSeconds=1.55;
export function stringReveal(index,count,time) {
  const t=Math.max(0,Math.min(1,(time-.85*index/Math.max(1,count-1))/.63));
  return 1-(1-t)**3;
}
export class Concert {
  constructor(song,start) {
    this.song=song; this.start=start;
    this.strings=concertStrings(song);
    const byPitch=new Map(this.strings.map(w=>[w.midi,w]));
    this.notes=song.events.map((e,i)=>({...e,wire:byPitch.get(e.midi),
      time:introSeconds+e.beat*60/song.bpm,contact:e.lead ? .38+.23*Math.sin(i*1.8) : .67,
      direction:i%2?-1:1}));
    this.melody=this.notes.filter(e=>e.lead);
    this.leadIndex=0;
    this.duration=introSeconds+song.beats*60/song.bpm+1;
    this.audioIndex=0;this.visualIndex=0;this.previousLead=null;
  }
  schedule(time,play) {
    while(this.audioIndex<this.notes.length && this.notes[this.audioIndex].time<=time+.15){
      const note=this.notes[this.audioIndex++];
      if(note.time>=time-.09)play(note,Math.max(0,note.time-time));
    }
  }
  advance(time,strike) {
    while(this.visualIndex<this.notes.length && this.notes[this.visualIndex].time<=time){
      const note=this.notes[this.visualIndex++];
      if(note.lead){this.previousLead=note;this.leadIndex++;}
      const age=time-note.time;
      if(age<1.25)strike(note,age);
    }
  }
}
