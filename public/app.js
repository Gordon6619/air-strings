import {Scene,Crossing,closestEnd,config,distance,projection,tone,clamp} from './core.js';
import {Tracker,Gestures} from './gesture.js';
import {Instrument} from './audio.js';
import {Camera} from './camera.js';
const $=id=>document.getElementById(id), canvas=$('canvas'), pen=canvas.getContext('2d');
const scene=new Scene(),gestures=new Gestures(scene),mouseSweep=new Crossing(),audio=new Instrument();
const colors=['#ee996f','#e8ba79','#c6d793','#81c7b9','#9baed9','#cfade0','#edafbd','#dbd7b2'];
let tracker=new Tracker(),mode='preview',draft=null,del=false,points=[],revision=-1,serial=0,run=0;
let firstCamera=true,hasEdited=false,mouseOn=false,stableAt=null,perSecond=performance.now(),draws=0,tracks=0,lastResult=-1;
let stateMsg='',noteAt=0,lastPointer=null,activePointer=null;
const hits=new Map(),seen=new Set(),log=[];
const stats={drawFps:0,trackFps:0,inferMs:0,dispatchMs:null,plucks:0,camera:null};
function status(msg){if(msg&&msg!==stateMsg){$('status').textContent=stateMsg=msg}}
function chord(){
  const aspect=scene.data.aspect,notes=[130.8128,164.8138,195.9977,246.9417,293.6648];
  return {schemaVersion:1,aspect,tuning:scene.data.tuning,strings:notes.map((hz,i)=>{
    const length=110/hz,alpha=(i-2)*0.13+0.34,dx=length*Math.cos(alpha)/Math.max(1,aspect),dy=length*Math.sin(alpha)/Math.max(1,1/aspect);
    const cx=0.49+(i-2)*0.045,cy=0.23+i*0.132;
    return {id:'s'+(i+1),createdSeq:i+1,a:{x:cx+dx/2,y:cy+dy/2},b:{x:cx-dx/2,y:cy-dy/2}};
  })};
}
scene.load(chord());scene.history=[];
function color(w){return colors[(w.createdSeq-1+colors.length)%colors.length]}
function cancel(){draft=null;activePointer=null;gestures.reset();mouseSweep.reset();lastPointer=null;points=[];hits.clear()}
function changeMode(m){
  mode=m;$('mode').textContent=({camera:'攝影機演奏',loading:'啟動中',preview:'試奏待命',mouse:'演奏中',stopped:'已停止'})[m];
  $('viewLabel').textContent=({camera:'攝影機演奏',loading:'連接攝影機',preview:'滑鼠試奏',mouse:'滑鼠演奏',stopped:'已停止'})[m];
  $('lamp').classList.toggle('on',m==='camera'||m==='mouse');$('stage').classList.toggle('camera',m==='camera');
  $('camera').disabled=m==='loading'||m==='camera';$('stop').disabled=m==='stopped';
}
function stop(message='已停止演奏，琴弦配置已保留。'){
  ++run;camera.stop();cancel();audio.stop();mouseOn=false;stableAt=null;stats.trackFps=0;tracks=0;lastResult=-1;
  changeMode('stopped');status(message);
}
async function mouseStart(){
  const token=++run;camera.stop();cancel();audio.stop();mouseOn=false;
  try{await audio.unlock();if(token!==run)return;mouseOn=true;changeMode('mouse');status('移動滑鼠撥弦，拖曳空白處建弦，拖曳端點調音。')}
  catch(e){if(token===run)stop('無法啟動音訊：'+e.message)}
}
function visual(w,id,position,velocity,delay=0){
  const t=performance.now()+delay*1000;hits.set(w.id,{t,position,velocity});
  const note=tone(w.a,w.b,scene.data);$('pitch').textContent=note.name;$('hz').textContent=note.hz.toFixed(1)+' Hz';noteAt=t;
}
function perform(events){
  if(!events.length)return;
  const start=events[0].captureMs;
  for(const e of events){
    if(seen.has(e.id))continue;
    seen.add(e.id);if(seen.size>512)seen.delete(seen.values().next().value);
    const w=scene.data.strings.find(s=>s.id===e.stringId);if(!w)continue;
    const delay=clamp((e.captureMs-start)/1000,0,0.04);
    audio.play(e.frequencyHz,e.velocity01,delay);visual(w,e.id,e.position01,e.velocity01,delay);
    stats.dispatchMs=performance.now()-e.captureMs;stats.plucks++;
    log.push({id:e.id,string:e.stringId,input:e.trackId,captureMs:e.captureMs,dispatchMs:stats.dispatchMs,frequencyHz:e.frequencyHz});
    if(log.length>240)log.shift();
  }
}
async function manual(w){
  if(!w||mode==='stopped'||mode==='loading')return;await audio.unlock();
  if(mode==='stopped'||mode==='loading')return;
  const hz=tone(w.a,w.b,scene.data).hz;
  perform([{id:'key'+(++serial),trackId:'key',stringId:w.id,captureMs:performance.now(),position01:0.5,velocity01:0.6,frequencyHz:hz}]);
}
const camera=new Camera($('video'),data=>{
  if(mode!=='camera'||data.t<=lastResult)return;
  lastResult=data.t;points=tracker.match(data.hands,data.t,scene.data.aspect);stats.inferMs=data.inferMs;tracks++;
  if(!del){
    const events=gestures.update(data.t,points);perform(events.map(e=>({...e,id:'hand:'+e.id})));
    if(points.length){stableAt??=data.t;
      if(data.t-stableAt>=500)status(gestures.message==='請張開手掌進入取景框'?'雙手一起捏合，拉開做一條弦。':gestures.message);
    }else{stableAt=null;status('請將雙手張開，移入畫面。')}
  }
},err=>stop(err),settings=>{
  stats.camera=settings;tracker=new Tracker();lastResult=-1;
  if(firstCamera&&!hasEdited){scene.clear();scene.history=[]}
  firstCamera=false;scene.data={...scene.data,aspect:settings.width/settings.height};scene.revision++;
  changeMode('camera');layout();status('請將雙手張開，移入畫面。');
});
$('camera').onclick=async()=>{
  stop();const token=++run;changeMode('loading');status('正在準備手部模型與攝影機；首次使用需要下載。');
  try{await audio.unlock();if(token===run)await camera.start()}
  catch(e){if(token===run)stop(e.name==='NotAllowedError'?'未取得攝影機授權。可在瀏覽器允許後重試，或選「滑鼠演奏」。':e.name==='NotFoundError'?'找不到攝影機。接上攝影機後重試，或選「滑鼠演奏」。':e.message)}
};
$('mouse').onclick=mouseStart;$('stop').onclick=()=>stop();
$('sound').onclick=async()=>{await audio.unlock();audio.play(220,0.55);status('試音 A3 · 220 Hz')};
$('vol').oninput=e=>{audio.volume(e.target.value/100);$('percent').textContent=e.target.value+'%'};
$('tuning').onchange=e=>{cancel();scene.replace({...scene.data,tuning:e.target.value});hasEdited=true};
function setDelete(on){cancel();del=on;$('delete').classList.toggle('selected',on);$('delete').setAttribute('aria-pressed',String(on));status(on?'點選要刪除的弦，按 Esc 返回。':'已返回演奏模式。')}
$('delete').onclick=()=>setDelete(!del);
$('undo').onclick=()=>{cancel();scene.undo();hasEdited=true;status('已復原上一步。')};
$('clear').onclick=()=>{cancel();$('confirm').showModal()};
$('cancelClear').onclick=()=>$('confirm').close();$('yesClear').onclick=()=>{scene.clear();hasEdited=true;$('confirm').close();status('琴弦已清除，可從空白畫面重新建弦。')};
$('preset').onclick=()=>{cancel();scene.load(chord());hasEdited=true;status('已載入五弦和弦。')};
$('guideBtn').onclick=()=>$('guide').showModal();$('closeGuide').onclick=()=>$('guide').close();
$('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('stage').requestFullscreen()}catch{status('目前視窗無法切換全螢幕。')}};
function download(name,obj){const url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
$('save').onclick=()=>download('air-strings.scene.json',scene.data);
$('report').onclick=()=>download('air-strings.diagnostics.json',{configVersion:config.version,environment:navigator.userAgent,mode,stats,events:log});
$('load').onclick=()=>$('file').click();$('file').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>100000)throw Error('場景檔案太大');const data=JSON.parse(await f.text());
  if(mode==='camera'&&Math.abs((data.aspect??16/9)-scene.data.aspect)>0.01)throw Error('請先停止攝影機再匯入不同比例的場景');
  scene.load(data);cancel();hasEdited=true;status('場景已載入。');
}catch(err){status('匯入失敗：'+err.message)}finally{e.target.value=''}};
function pos(e){const r=canvas.getBoundingClientRect();return {x:1-clamp((e.clientX-r.left)/r.width),y:clamp((e.clientY-r.top)/r.height)}}
function pickWire(p){return scene.data.strings.map(w=>({w,...projection(p,w,scene.data.aspect)})).filter(c=>c.along>=0&&c.along<=1&&Math.abs(c.side)<0.035).sort((a,b)=>Math.abs(a.side)-Math.abs(b.side))[0]?.w}
canvas.onpointerdown=e=>{
  if(e.button!==0||mode==='loading'||mode==='stopped'||activePointer!==null)return;
  const p=pos(e);canvas.focus();if(del){const w=pickWire(p);if(w){scene.remove(w.id);hasEdited=true}return}
  if(mode==='camera')return;
  if(!mouseOn){void audio.unlock().catch(()=>status('請按試音鍵啟用音訊。'));mouseOn=true;changeMode('mouse')}
  activePointer=e.pointerId;canvas.setPointerCapture(e.pointerId);mouseSweep.reset();
  const end=closestEnd(p,scene.data);
  if(end){const w=scene.data.strings.find(x=>x.id===end.id);draft={a:w.a,b:w.b,...end}}
  else{draft={a:p,b:p};status('拖曳拉出琴弦，放開固定。')}
};
canvas.onpointermove=e=>{
  if(mode==='camera'||mode==='loading'||mode==='stopped'||del)return;
  if(activePointer!==null&&e.pointerId!==activePointer)return;
  const p=pos(e);lastPointer=p;
  if(draft){draft[draft.end||'b']=p;return}
  if(mouseOn){const events=mouseSweep.sample('mouse',p,e.timeStamp,scene.data);
    perform(events.map(e=>({...e,id:'mouse:'+e.id})))}
};
canvas.onpointerup=e=>{if(!draft||activePointer!==e.pointerId)return;draft[draft.end||'b']=pos(e);
  const ok=scene.commit(draft.a,draft.b,draft.id);hasEdited||=ok;draft=null;activePointer=null;mouseSweep.reset();
  status(ok?'琴弦已固定，可以撥奏。':'弦太短或已達 8 弦上限。');
};
canvas.onpointercancel=()=>cancel();canvas.onlostpointercapture=()=>{if(activePointer!==null)cancel()};canvas.onpointerleave=()=>{lastPointer=null;mouseSweep.reset()};
document.addEventListener('keydown',e=>{
  if(document.querySelector('dialog[open]')||e.target.matches('input,select,textarea'))return;
  if(e.key==='Escape'){setDelete(false);return}
  if(e.ctrlKey&&e.key.toLowerCase()==='z'){e.preventDefault();$('undo').click();return}
  if(!e.repeat&&/^[1-8]$/.test(e.key))void manual(scene.data.strings[Number(e.key)-1]);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(mode==='camera'||mode==='loading'||mode==='mouse'))stop('視窗已切換，按演奏方式重新開始。')});
window.addEventListener('pagehide',()=>{camera.stop();audio.stop()});
function layout(){
  const r=$('stage').getBoundingClientRect(),aspect=scene.data.aspect,w=Math.min(r.width,r.height*aspect),h=w/aspect;
  const plane=$('plane');plane.style.width=w+'px';plane.style.height=h+'px';
  const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));
}
new ResizeObserver(layout).observe($('stage'));
const joints=[[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[0,17]];
function render(now){
  const W=canvas.width,H=canvas.height,scale=Math.min(W,H)/650,px=p=>({x:(1-p.x)*W,y:p.y*H});
  pen.clearRect(0,0,W,H);
  if(mode!=='camera'){pen.fillStyle='#66867f52';const step=Math.max(12,Math.round(28*scale));
    for(let x=step/2;x<W;x+=step)for(let y=step/2;y<H;y+=step)pen.fillRect(x,y,1.2*scale,1.2*scale);}
  const edit=draft||gestures.draft;
  function draw(w,preview=false){
    const a=px(w.a),b=px(w.b),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
    const hit=hits.get(w.id),age=hit?(now-hit.t)/1000:9,amp=age>=0&&age<1?Math.sin(age*72)*Math.exp(-6*age)*18*scale*hit.velocity:0;
    const base=preview?'#f3e9d2':color(w),note=tone(w.a,w.b,scene.data);
    pen.save();pen.strokeStyle=base;pen.fillStyle=base;pen.lineWidth=2.3*scale;
    if(age<0.22){pen.shadowColor=base;pen.shadowBlur=12*scale}
    if(preview&&distance(w.a,w.b,scene.data.aspect)<config.minLength)pen.setLineDash([5*scale,4*scale]);
    pen.beginPath();pen.moveTo(a.x,a.y);
    for(let i=1;i<=32;i++){const t=i/32,k=clamp(hit?.position??0.5,0.01,0.99),v=amp*Math.sin(Math.PI*0.5*(t<k?t/k:(1-t)/(1-k)));pen.lineTo(a.x+t*dx-dy/len*v,a.y+t*dy+dx/len*v)}
    pen.stroke();pen.setLineDash([]);pen.shadowBlur=0;
    for(const p of [a,b]){pen.beginPath();pen.arc(p.x,p.y,5*scale,0,2*Math.PI);pen.stroke();pen.beginPath();pen.arc(p.x,p.y,2*scale,0,2*Math.PI);pen.fill()}
    pen.font=Math.max(11,14*scale)+'px monospace';const left=a.x<b.x?a:b;
    pen.fillText(note.name+(note.limited?' · 限幅':''),clamp(left.x+8*scale,2,W-80*scale),Math.max(14*scale,left.y-10*scale));
    pen.restore();
  }
  for(const w of scene.data.strings)if(w.id!==edit?.id)draw(w);
  if(edit){draw({...edit,createdSeq:1},true);const n=tone(edit.a,edit.b,scene.data),old=scene.data.strings.find(w=>w.id===edit.id);
    $('pitch').textContent=(old?tone(old.a,old.b,scene.data).name+' → ':'')+n.name;$('hz').textContent=n.hz.toFixed(1)+' Hz';noteAt=now}
  if(mode==='camera')for(const hand of points){
    if($('bones').checked){pen.strokeStyle='#96dbc5';pen.lineWidth=2*scale;for(const chain of joints){pen.beginPath();chain.forEach((idx,i)=>{const p=px(hand.points[idx]);if(i)pen.lineTo(p.x,p.y);else pen.moveTo(p.x,p.y)});pen.stroke()}}
    const p=px(hand.points[8]);pen.strokeStyle='#fff6d0';pen.beginPath();pen.arc(p.x,p.y,6*scale,0,2*Math.PI);pen.stroke();
  }
  if(!edit&&now-noteAt>2200&&$('pitch').textContent!=='—'){$('pitch').textContent='—';$('hz').textContent='等待撥弦'}
  if(revision!==scene.revision){revision=scene.revision;layout();refresh();mouseSweep.reset();gestures.crossing.reset()}
  draws++;if(now-perSecond>=1000){const seconds=(now-perSecond)/1000;stats.drawFps=Math.round(draws/seconds);stats.trackFps=Math.round(tracks/seconds);draws=tracks=0;perSecond=now;
    $('metrics').textContent='繪圖 '+stats.drawFps+' fps ｜ 追蹤 '+stats.trackFps+' fps\n推論 '+stats.inferMs.toFixed(1)+' ms ｜ 累計 '+stats.plucks+' 音\n影格至派送 '+(stats.dispatchMs?.toFixed(1)??'—')+' ms'+(stats.camera?'\n攝影 '+stats.camera.width+' × '+stats.camera.height+' / '+stats.camera.frameRate+' fps':'');
  }
  requestAnimationFrame(render);
}
function refresh(){
  $('count').textContent=scene.data.strings.length+' / 8';$('undo').disabled=!scene.history.length;
  $('clear').disabled=!scene.data.strings.length;$('tuning').value=scene.data.tuning;
  $('wires').replaceChildren(...scene.data.strings.map((w,i)=>{const b=document.createElement('button'),dot=document.createElement('i'),k=document.createElement('small');
    dot.style.background=color(w);k.textContent=String(i+1);b.append(dot,k,tone(w.a,w.b,scene.data).name);b.title='試奏第 '+(i+1)+' 弦';b.onclick=()=>manual(w);return b}));
}
changeMode('preview');status('點「滑鼠演奏」後，將游標掃過琴弦即可試奏。');layout();refresh();requestAnimationFrame(render);

