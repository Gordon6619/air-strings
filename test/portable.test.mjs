import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../Air-Strings.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
function harness(){
  const drawCall=()=>{}, painted=new Proxy({}, {get:(target,key)=>target[key]??drawCall});
  const elements=new Map(), listeners=new Map();let render=null,at=0,outputs=0,timerId=0;
  const timers=new Map();
  function element(){
    return {style:{},classList:{toggle(){}},children:[],textContent:'',checked:true,
      getContext:()=>painted,getBoundingClientRect:()=>({left:0,top:0,width:1000,height:600}),
      replaceChildren(...children){this.children=children},append(...children){this.children.push(...children)},
      setAttribute(){},focus(){},setPointerCapture(){},showModal(){this.open=true},close(){this.open=false},click(){return this.onclick?.()}};
  }
  for(const match of html.matchAll(/ id="([^"]+)"/g))elements.set(match[1],element());
  const $=key=>elements.get(key);
  const audioParam=()=>({setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){},cancelAndHoldAtTime(){}});
  const node=()=>({connect(next){return next},disconnect(){},gain:audioParam(),frequency:audioParam(),setPeriodicWave(){},start(){outputs++},stop(){}});
  class Audio{
    state='running';get currentTime(){return at/1000}destination=node();async resume(){}createGain(){return node()}
    createDynamicsCompressor(){return {...node(),threshold:{},ratio:{}}}createOscillator(){return node()}
    createPeriodicWave(){return {}}createBiquadFilter(){return node()}
  }
  const document={getElementById:$,createElement:element,addEventListener:(k,f)=>listeners.set(k,f),querySelector:()=>null};
  const sandbox={document,performance:{now:()=>at},URL,Blob,structuredClone,AudioContext:Audio,
    window:{addEventListener(){},devicePixelRatio:1},ResizeObserver:class{observe(){}},
    requestAnimationFrame:f=>{render=f},setTimeout,clearTimeout,setInterval:f=>{timers.set(++timerId,f);return timerId},clearInterval:id=>timers.delete(id),console,
    fetch:async()=>{throw Error('offline')},AbortSignal,crypto:globalThis.crypto};
  vm.runInNewContext(script,sandbox,{filename:'Air-Strings.inline.js'});
  return {$,frame(ms=17){at+=ms;for(const f of timers.values())f();render(at)},get outputs(){return outputs},sandbox};
}
test('單檔實際入口可離線初始化，滑鼠建弦、試音、清場復原和停止',async()=>{
  const ui=harness();ui.frame();assert.equal(ui.$('count').textContent,'5 / 8');
  await ui.$('mouse').onclick();const canvas=ui.$('canvas');
  const evt=(x,y,t)=>({clientX:x,clientY:y,button:0,pointerId:1,timeStamp:t});
  canvas.onpointerdown(evt(50,60,10));canvas.onpointermove(evt(800,90,50));canvas.onpointerup(evt(800,90,51));ui.frame();
  assert.equal(ui.$('count').textContent,'6 / 8');await ui.$('wires').children[5].onclick();
  assert.equal(ui.outputs,1);ui.$('clear').onclick();ui.$('yesClear').onclick();ui.frame();assert.equal(ui.$('count').textContent,'0 / 8');
  ui.$('undo').onclick();ui.frame();assert.equal(ui.$('count').textContent,'6 / 8');
  ui.$('stop').onclick();assert.match(ui.$('mode').textContent,/停止/);
  await ui.$('wires').children[0].onclick();assert.equal(ui.outputs,1);
});
test('名曲在單檔自動建弦、發聲、換曲、自然結束與手動停止後還原場景',async()=>{
  const ui=harness();ui.frame();
  const choose=id=>ui.$('song').onchange({target:{value:id}});
  await choose('canon');ui.frame();assert.match(ui.$('count').textContent,/演奏弦/);
  assert.equal(ui.outputs,0);for(let i=0;i<95;i++)ui.frame();
  assert.ok(ui.outputs>=2);assert.equal(ui.$('pitch').textContent,'F♯5');
  await choose('ode');ui.frame();
  assert.equal(ui.$('songTitle').textContent,'歡樂頌');
  const before=ui.outputs;ui.frame(600);assert.equal(ui.outputs,before);
  for(let i=0;i<65;i++)ui.frame();assert.equal(ui.$('pitch').textContent,'E4');
  ui.frame(40000);assert.match(ui.$('status').textContent,/歡樂頌.*完畢/);
  assert.equal(ui.$('count').textContent,'5 / 8');
  await choose('star');ui.$('stop').onclick();ui.frame();
  const ended=ui.outputs;ui.frame(3000);assert.equal(ui.outputs,ended);
  assert.equal(ui.$('concertHud').hidden,true);
  await ui.$('mouse').onclick();await ui.$('wires').children[0].onclick();assert.equal(ui.outputs,ended+1);
});
test('首次無網路時攝影機顯示原因，切到滑鼠可演奏原場景',async()=>{
  const ui=harness();ui.frame();await ui.$('camera').onclick();
  assert.match(ui.$('status').textContent,/連線|下載/);assert.equal(ui.$('camera').disabled,false);
  await ui.$('mouse').onclick();await ui.$('wires').children[0].onclick();
  assert.equal(ui.outputs,1);assert.equal(ui.$('count').textContent,'5 / 8');
});
