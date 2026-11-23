// Generated from src/gesture.ts by npm run build.
import {config,clamp,center,distance,closestEnd,projection,tone,Scene,Crossing} from './core.js';



export class Tracker {
  tracks        =[];serial=0;
  match(points          ,t       ,aspect       )       {
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
    const assigned=new Map              (),used=new Set        ();
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



export class Gestures {
  fingers=new Map               (); crossing=new Crossing(); draft           =null;
  blocked=true;last=-Infinity;message='請張開手掌進入取景框';
  scene      ;
  constructor(scene      ){this.scene=scene}
  reset(){this.fingers.clear();this.crossing.reset();this.draft=null;this.blocked=true;this.last=-Infinity}
  resetSweep(id       ){this.crossing.reset(id);this.crossing.reset(id+':thumb')}
  catchString(f       ,data          ){
    if(closestEnd(f.anchor,data))return;
    let nearest=.035;
    for(const w of data.strings){
      const p=projection(f.anchor,w,data.aspect);
      if(p.along<=0||p.along>=1||Math.abs(p.side)>=nearest)continue;
      nearest=Math.abs(p.side);
      f.grip={wire:w.id,along:p.along,start:f.anchor,pull:0};
    }
  }
  playFingers(f       ,t       ,data          ,movingId        )        {
    if(!f.opened||f.frames<config.stableFrames)return [];
    if(movingId && f.closedAt===t)this.catchString(f,data);
    const grip=f.grip;
    if(grip){
      const w=data.strings.find(s=>s.id===grip.wire);
      if(!w){f.grip=null;return []}
      grip.pull=clamp(projection(f.lastAnchor,w,data.aspect).side-projection(grip.start,w,data.aspect).side,-.20,.20);
      if(f.closed){this.message='已捏住弦身，拉向側邊後鬆開兩指';return []}
      f.grip=null;this.resetSweep(f.id);this.message='拇指或食指劃過琴弦，或捏住弦身再撥放';
      if(Math.abs(grip.pull)<.012)return [];
      f.played.set(w.id,t);
      return [{type:'pluck',id:'release'+(++this.crossing.seq),trackId:f.id,stringId:w.id,captureMs:t,
        position01:grip.along,velocity01:clamp(Math.abs(grip.pull)/.12,.12,1),
        direction:-Math.sign(grip.pull),frequencyHz:tone(w.a,w.b,data).hz}];
    }
    if(f.closed||f.pending||f.candidate!==null){this.resetSweep(f.id);return []}
    const hits=this.crossing.sample(f.id,f.tip,t,data,movingId)
      .concat(this.crossing.sample(f.id+':thumb',f.thumb,t,data,movingId))
      .sort((a,b)=>a.captureMs-b.captureMs);
    return hits.filter(hit=>{
      const last=f.played.get(hit.stringId)??-Infinity;
      if(hit.captureMs-last<config.cooldownMs)return false;
      f.played.set(hit.stringId,hit.captureMs);return true;
    });
  }
  update(t       ,hands       )        {
    if(t<=this.last)return [];
    const aspect=this.scene.data.aspect;this.last=t;
    const active         =[];
    for(const {id,points} of hands){
      const tip=points[8],thumb=points[4],palm=Math.max(distance(points[5],points[17],aspect),.65*distance(points[0],points[9],aspect));
      if(palm<config.minPalm)continue;
      const ratio=distance(tip,thumb,aspect)/palm;
      const anchor=center(tip,thumb);anchor.x=clamp(anchor.x);anchor.y=clamp(anchor.y);
      let f=this.fingers.get(id);
      if(f&&t-f.t>config.gapMs){this.resetSweep(id);f.grip=null;f.candidate=null}
      const missed=f&&t-f.t>config.gapMs;
      const retain=f&&missed&&t-f.t<=config.lossMs&&this.draft?.hands.includes(id);
      if(!f||(missed&&!retain)||distance(f.tip,tip,aspect)>config.jump){
        this.resetSweep(id);
        if(f&&this.draft?.hands.includes(id)){this.draft=null;this.blocked=true;}
        f={id,thumb,grip:null,played:new Map(),tip,anchor,closed:false,candidate:null,frames:0,t,closedAt:-Infinity,opened:false,lastAnchor:anchor,pending:false};
        this.fingers.set(id,f);
      }
      const change=f.closed?ratio>config.pinchOff:ratio<config.pinchOn;
      f.pending=ratio<config.pinchOn;
      if(!change)f.candidate=null;
      else if(f.candidate===null)f.candidate=t;
      else if(t-f.candidate>=(f.closed
        ? (ratio>.64?25:config.releaseMs)
        : (ratio<.18?32:config.pinchMs))){
        f.closed=!f.closed;f.candidate=null;if(f.closed)f.closedAt=t;
      }
      if(ratio>config.pinchOff)f.opened=true;
      if(ratio<=config.pinchOff){
        const dt=Math.max(1,t-f.t),delta=distance(f.lastAnchor,anchor,aspect);
        const tau=delta>.018?4:28,blend=1-Math.exp(-dt/tau);
        f.lastAnchor=f.closed?{x:f.lastAnchor.x+(anchor.x-f.lastAnchor.x)*blend,
          y:f.lastAnchor.y+(anchor.y-f.lastAnchor.y)*blend}:anchor;
      }
      f.thumb=thumb;f.tip=tip;f.anchor=anchor;f.t=t;f.frames++;
      active.push(f);
    }
    const ids=new Set(active.map(f=>f.id));
    for(const [id,f] of this.fingers)if(!ids.has(id)){
      this.resetSweep(id);f.grip=null;f.candidate=null;f.opened=false;f.frames=0;
      if(t-f.t>config.lossMs)this.fingers.delete(id);
    }
    if(this.draft){
      const d=this.draft,owners=d.hands.map(id=>active.find(f=>f.id===id));
      if(owners.some(f=>!f)||owners.some(f=>f.frames<config.stableFrames)){
        if(d.hands.some(id=>!this.fingers.has(id))){this.draft=null;this.blocked=true;}
        this.message='手部遮擋，請重新張開手掌';return [];
      }
      const fs=owners            ;
      if(d.end)d[d.end]=fs[0].lastAnchor;
      else {d.a=fs[0].lastAnchor;d.b=fs[1].lastAnchor}
      if(fs.some(f=>!f.closed)){
        const original=d.id && this.scene.data.strings.find(w=>w.id===d.id);
        const unchanged=original && distance(original.a,d.a,aspect)+distance(original.b,d.b,aspect)<0.001;
        const saved=unchanged || this.scene.commit(d.a,d.b,d.id);
        this.message=saved?'弦已固定，伸出食指撥奏':'弦太短或數量已滿';
        this.draft=null;this.blocked=true;this.crossing.reset();
        for(const f of this.fingers.values())f.grip=null;
        if(saved && !d.id && fs.filter(f=>f.closed).length===1){
          const index=fs[0].closed?0:1;
          const wire=this.scene.data.strings[this.scene.data.strings.length-1];
          this.draft={id:wire.id,a:wire.a,b:wire.b,end:index===0?'a':'b',hands:[fs[index].id]};
          this.message='一手拉弦，另一手可用拇指或食指撥奏';
        }
      }else if(d.end && distance(d.a,d.b,aspect)>=0.02){
        const data={...this.scene.data,strings:this.scene.data.strings.map(w=>w.id===d.id?{...w,a:d.a,b:d.b}:w)};
        return active.flatMap(f=>{
          if(f.id===d.hands[0])return [];
          return this.playFingers(f,t,data,d.id);
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
      if(end){const wire=this.scene.data.strings.find(w=>w.id===end.id) ;
        this.draft={a:wire.a,b:wire.b,...end,hands:[f.id]};this.crossing.reset();this.message='一手拉弦，另一手可用拇指或食指撥奏';return [];}
    }
    for(const f of held)if(f.closedAt===t)this.catchString(f,this.scene.data);
    if(held.length===2&&held.every(f=>!f.grip)&&Math.abs(held[0].closedAt-held[1].closedAt)<=config.pairMs){
      if(this.scene.data.strings.length>=config.maxStrings){this.blocked=true;this.message='已達 8 弦上限';return [];}
      this.draft={a:held[0].anchor,b:held[1].anchor,hands:held.map(f=>f.id)};this.crossing.reset();this.message='拉開雙手，放開固定';return [];
    }
    if(held.some(f=>!f.grip&&t-f.closedAt>config.pairMs))this.message='空白處建弦時，兩手分開指尖後再一起捏合';
    return usable.flatMap(f=>this.playFingers(f,t,this.scene.data)).sort((a,b)=>a.captureMs-b.captureMs);
  }
}
