// Generated from src/core.ts by npm run build.
                                         
                                                                    
                                                                                                                                                
                                                                                                                                                           
export const config = Object.freeze({
  version:1, maxStrings:8, maxVoices:16, minLength:0.18, endpointRadius:0.035,
  pinchOn:0.30, pinchOff:0.45, pinchMs:70, releaseMs:60, pairMs:300,
  band:0.008, minSpeed:0.12, cooldownMs:90, gapMs:100, lossMs:250, stableFrames:3,
  minPalm:0.024, jump:0.40, ambiguous:0.055, history:30
});
export const clamp=(v       ,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
export const metric=(p      ,aspect       )=>({x:p.x*Math.max(aspect,1),y:p.y*Math.max(1/aspect,1)});
export const distance=(a      ,b      ,aspect       )=>{const d=metric({x:a.x-b.x,y:a.y-b.y},aspect);return Math.hypot(d.x,d.y)};
export const center=(a      ,b      )=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
export function tone(a      ,b      ,scene          ){
  const raw=scene.referenceLength*scene.referenceHz/Math.max(distance(a,b,scene.aspect),1e-8);
  const hz=clamp(raw,110,880), midi=Math.round(69+12*Math.log2(hz/440));
  const name=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][midi%12]+(Math.floor(midi/12)-1);
  return {hz:scene.tuning==='free'?hz:440*2**((midi-69)/12),name,limited:raw!==hz};
}
export function projection(p      ,w     ,aspect       ){
  const a=metric(w.a,aspect), b=metric(w.b,aspect), q=metric(p,aspect);
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
  return {along:((q.x-a.x)*dx+(q.y-a.y)*dy)/(len*len),side:((q.y-a.y)*dx-(q.x-a.x)*dy)/len};
}
export function closestEnd(p      ,scene          ){
  let best                             =null, limit       =config.endpointRadius;
  for(const w of scene.strings) for(const end of ['a','b']         ){
    const d=distance(p,w[end],scene.aspect);if(d<limit){limit=d;best={id:w.id,end}}
  }
  return best;
}
const validPoint=(p      )=>p && [p.x,p.y].every(v=>Number.isFinite(v)&&v>=0&&v<=1);
export function parseScene(value    )           {
  if(!value||value.schemaVersion!==1||!Array.isArray(value.strings)) throw Error('不支援的場景格式');
  const out={aspect:16/9,tuning:'chromatic',referenceHz:220,referenceLength:0.5,...value}             ;
  if(![out.aspect,out.referenceHz,out.referenceLength].every(v=>Number.isFinite(v)&&v>0)||!['chromatic','free'].includes(out.tuning)||out.strings.length>config.maxStrings)throw Error('場景設定無效');
  const ids=new Set        ();
  for(const w of out.strings){
    if(!w||typeof w.id!=='string'||!w.id||ids.has(w.id)||!Number.isSafeInteger(w.createdSeq)||w.createdSeq<0||!validPoint(w.a)||!validPoint(w.b)||distance(w.a,w.b,out.aspect)<1e-6)throw Error('弦的端點或識別碼無效');
    ids.add(w.id);
  }
  out.strings=structuredClone(out.strings).sort((a,b)=>a.createdSeq-b.createdSeq);
  return out;
}
export class Scene {
  data          =parseScene({schemaVersion:1,strings:[]});
  history            =[]; next=1; revision=0;
  replace(next          ){this.history.push(this.data);if(this.history.length>config.history)this.history.shift();this.data=next;this.revision++}
  load(v        ){this.replace(parseScene(v))}
  undo(){const prev=this.history.pop();if(prev){this.data=prev;this.revision++}}
  clear(){if(this.data.strings.length)this.replace({...this.data,strings:[]})}
  remove(id       ){const ws=this.data.strings.filter(w=>w.id!==id);if(ws.length!==this.data.strings.length)this.replace({...this.data,strings:ws})}
  commit(a      ,b      ,id        ){
    if(!validPoint(a)||!validPoint(b)||distance(a,b,this.data.aspect)<config.minLength)return false;
    const s=this.data.strings;
    if(id){if(!s.some(w=>w.id===id))return false;this.replace({...this.data,strings:s.map(w=>w.id===id?{...w,a,b}:w)});}
    else{if(s.length>=config.maxStrings)return false;while(s.some(w=>w.id==='s'+this.next))this.next++;
      const seq=Math.max(this.next,...s.map(w=>w.createdSeq+1));this.next=seq+1;this.replace({...this.data,strings:[...s,{id:'s'+seq,createdSeq:seq,a,b}]});}
    return true;
  }
}
                                           
                                                                                                        
export class Crossing {
  contacts=new Map                            (); seq=0;
  reset(hand        ){if(hand===undefined)this.contacts.clear();else this.contacts.delete(hand)}
  sample(hand       ,p      ,t       ,scene          )        {
    let strings=this.contacts.get(hand);if(!strings){strings=new Map();this.contacts.set(hand,strings)}
    const events        =[];
    for(const w of scene.strings){
      let c=strings.get(w.id);if(!c){c={side:0,lastHit:-Infinity};strings.set(w.id,c)}
      const {side}=projection(p,w,scene.aspect), zone=Math.abs(side)>config.band?Math.sign(side):0;
      const prev=c.previous;
      if(prev&&t<=prev.t)continue;
      if(!prev||t-prev.t>config.gapMs){c.side=zone;c.hit=undefined;}
      else {
        if(c.side&&Math.sign(side)!==Math.sign(prev.side)&&prev.side!==side){
          const u=prev.side/(prev.side-side);
          const q={x:prev.p.x+u*(p.x-prev.p.x),y:prev.p.y+u*(p.y-prev.p.y)};
          const along=projection(q,w,scene.aspect).along;
          const speed=Math.abs(side-prev.side)*1000/(t-prev.t);
          c.hit=along>0&&along<1&&Math.min(distance(q,w.a,scene.aspect),distance(q,w.b,scene.aspect))>config.endpointRadius&&speed>=config.minSpeed?{time:prev.t+u*(t-prev.t),along,speed}:undefined;
        }
        if(zone){
          if(c.side&&zone!==c.side&&c.hit&&c.hit.time-c.lastHit>=config.cooldownMs){
            c.lastHit=c.hit.time;events.push({type:'pluck',id:'p'+(++this.seq),stringId:w.id,trackId:hand,captureMs:c.hit.time,position01:c.hit.along,velocity01:clamp(c.hit.speed/2,0.09,1),frequencyHz:tone(w.a,w.b,scene).hz});
          }
          c.side=zone;c.hit=undefined;
        }
      }
      c.previous={p,t,side};
    }
    return events.sort((a,b)=>a.captureMs-b.captureMs);
  }
}

