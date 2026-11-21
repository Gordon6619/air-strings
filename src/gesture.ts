import {config,clamp,center,distance,closestEnd,Scene,Crossing} from './core.js';
import type {Point,Wire,Pluck} from './core.js';
type Hand={id:string;points:Point[]};
type Track={id:string;p:Point;v:Point;t:number};
export class Tracker {
  tracks:Track[]=[];serial=0;
  match(points:Point[][],t:number,aspect:number):Hand[]{
    const palms=points.map(p=>center(p[5],p[17]));
    this.tracks=this.tracks.filter(s=>t-s.t<=config.lossMs);
    const scores=this.tracks.flatMap(s=>palms.map((p,i)=>{
      const dt=Math.min(80,t-s.t);
      const guess={x:s.p.x+dt*s.v.x,y:s.p.y+dt*s.v.y};
      return {s,i,d:distance(guess,p,aspect)};
    })).sort((a,b)=>a.d-b.d);
    if(palms.length===2 && (distance(palms[0],palms[1],aspect)<config.ambiguous ||
      this.tracks.length===2 && Math.abs(
        scores.filter(k=>k.s===this.tracks[k.i]).reduce((a,k)=>a+k.d,0)-
        scores.filter(k=>k.s!==this.tracks[k.i]).reduce((a,k)=>a+k.d,0))<0.025)){
      this.tracks=[];return [];
    }
    const assigned=new Map<number,Track>(),used=new Set<string>();
    let candidates=scores;
    if(palms.length===2&&this.tracks.length===2){
      const direct=scores.filter(k=>k.s===this.tracks[k.i]);
      const swapped=scores.filter(k=>k.s!==this.tracks[k.i]);
      const cost=pair=>pair.reduce((total,k)=>total+k.d,0);
      candidates=cost(direct)<=cost(swapped)?direct:swapped;
    }
    for(const {s,i,d} of candidates)if(d<config.jump&&!used.has(s.id)&&!assigned.has(i)){assigned.set(i,s);used.add(s.id)}
    return points.map((landmarks,i)=>{
      const p=palms[i];let s=assigned.get(i);
      if(!s){s={id:'h'+(++this.serial),p,v:{x:0,y:0},t};this.tracks.push(s);}
      const dt=Math.max(1,t-s.t);s.v={x:(p.x-s.p.x)/dt,y:(p.y-s.p.y)/dt};s.p=p;s.t=t;
      return {id:s.id,points:landmarks};
    });
  }
}
type Finger={id:string;tip:Point;anchor:Point;closed:boolean;candidate:number|null;frames:number;t:number;closedAt:number;opened:boolean;lastAnchor:Point;pending:boolean};
export type Draft={a:Point;b:Point;id?:string;end?:'a'|'b';hands:string[]};
export class Gestures {
  fingers=new Map<string,Finger>(); crossing=new Crossing(); draft:Draft|null=null;
  blocked=true;last=-Infinity;message='請張開手掌進入取景框';
  scene:Scene;
  constructor(scene:Scene){this.scene=scene}
  reset(){this.fingers.clear();this.crossing.reset();this.draft=null;this.blocked=true;this.last=-Infinity}
  update(t:number,hands:Hand[]):Pluck[]{
    if(t<=this.last)return [];
    const aspect=this.scene.data.aspect;this.last=t;
    const active:Finger[]=[];
    for(const {id,points} of hands){
      const tip=points[8],thumb=points[4],palm=distance(points[5],points[17],aspect);
      if(palm<config.minPalm)continue;
      const ratio=distance(tip,thumb,aspect)/palm;
      const anchor=center(tip,thumb);anchor.x=clamp(anchor.x);anchor.y=clamp(anchor.y);
      let f=this.fingers.get(id);
      if(f&&t-f.t>config.gapMs)this.crossing.reset(id);
      const missed=f&&t-f.t>config.gapMs;
      const retain=f&&missed&&t-f.t<=config.lossMs&&this.draft?.hands.includes(id);
      if(!f||(missed&&!retain)||distance(f.tip,tip,aspect)>config.jump){
        this.crossing.reset(id);
        if(f&&this.draft?.hands.includes(id)){this.draft=null;this.blocked=true;}
        f={id,tip,anchor,closed:false,candidate:null,frames:0,t,closedAt:-Infinity,opened:false,lastAnchor:anchor,pending:false};
        this.fingers.set(id,f);
      }
      const change=f.closed?ratio>config.pinchOff:ratio<config.pinchOn;
      f.pending=ratio<config.pinchOn;
      if(!change)f.candidate=null;
      else if(f.candidate===null)f.candidate=t;
      else if(t-f.candidate>=(f.closed?config.releaseMs:config.pinchMs)){
        f.closed=!f.closed;f.candidate=null;if(f.closed)f.closedAt=t;
      }
      if(ratio>config.pinchOff)f.opened=true;
      f.tip=tip;f.anchor=anchor;f.t=t;f.frames++;
      if(ratio<=config.pinchOff)f.lastAnchor=anchor;
      active.push(f);
    }
    const ids=new Set(active.map(f=>f.id));
    for(const [id,f] of this.fingers)if(!ids.has(id)){
      this.crossing.reset(id);f.opened=false;f.frames=0;
      if(t-f.t>config.lossMs)this.fingers.delete(id);
    }
    if(this.draft){
      const d=this.draft,owners=d.hands.map(id=>active.find(f=>f.id===id));
      if(owners.some(f=>!f)||owners.some(f=>f.frames<config.stableFrames)){
        if(d.hands.some(id=>!this.fingers.has(id))){this.draft=null;this.blocked=true;}
        this.message='手部遮擋，請重新張開手掌';return [];
      }
      const fs=owners as Finger[];
      if(d.end)d[d.end]=fs[0].lastAnchor;
      else {d.a=fs[0].lastAnchor;d.b=fs[1].lastAnchor}
      if(fs.some(f=>!f.closed)){
        const original=d.id && this.scene.data.strings.find(w=>w.id===d.id);
        const unchanged=original && distance(original.a,d.a,aspect)+distance(original.b,d.b,aspect)<0.001;
        const saved=unchanged || this.scene.commit(d.a,d.b,d.id);
        this.message=saved?'弦已固定，伸出食指撥奏':'弦太短或數量已滿';
        this.draft=null;this.blocked=true;this.crossing.reset();
        if(saved && !d.id && fs.filter(f=>f.closed).length===1){
          const index=fs[0].closed?0:1;
          const wire=this.scene.data.strings[this.scene.data.strings.length-1];
          this.draft={id:wire.id,a:wire.a,b:wire.b,end:index===0?'a':'b',hands:[fs[index].id]};
          this.message='一手拉弦，另一手用食指撥奏';
        }
      }else if(d.end && distance(d.a,d.b,aspect)>=0.02){
        const data={...this.scene.data,strings:this.scene.data.strings.map(w=>w.id===d.id?{...w,a:d.a,b:d.b}:w)};
        return active.flatMap(f=>{
          if(f.id===d.hands[0]||f.closed||f.pending||!f.opened||f.frames<config.stableFrames){
            this.crossing.reset(f.id);return [];
          }
          return this.crossing.sample(f.id,f.tip,t,data,d.id);
        }).sort((a,b)=>a.captureMs-b.captureMs);
      }
      return [];
    }
    if(!active.length){this.blocked=true;this.message='請將手掌移入取景框';return []}
    if(this.blocked){
      if(active.every(f=>f.frames>=config.stableFrames&&f.opened&&!f.closed&&!f.pending))this.blocked=false;
      return [];
    }
    const usable=active.filter(f=>f.frames>=config.stableFrames&&f.opened);
    const held=usable.filter(f=>f.closed);
    for(const f of held){
      if(f.closedAt!==t)continue;
      const end=closestEnd(f.anchor,this.scene.data);
      if(end){const wire=this.scene.data.strings.find(w=>w.id===end.id)!;
        this.draft={a:wire.a,b:wire.b,...end,hands:[f.id]};this.crossing.reset();this.message='一手拉弦，另一手用食指撥奏';return [];}
    }
    if(held.length===2&&Math.abs(held[0].closedAt-held[1].closedAt)<=config.pairMs){
      if(this.scene.data.strings.length>=config.maxStrings){this.blocked=true;this.message='已達 8 弦上限';return [];}
      this.draft={a:held[0].anchor,b:held[1].anchor,hands:held.map(f=>f.id)};this.crossing.reset();this.message='拉開雙手，放開固定';return [];
    }
    if(held.some(f=>t-f.closedAt>config.pairMs)){this.blocked=true;this.message='兩手放開，再一起捏合';return []}
    return usable.flatMap(f=>{
      if(f.pending||f.closed){this.crossing.reset(f.id);return [];}
      return this.crossing.sample(f.id,f.tip,t,this.scene.data);
    }).sort((a,b)=>a.captureMs-b.captureMs);
  }
}
