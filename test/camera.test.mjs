import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Camera} from '../public/camera.js';
test('攝影機初始化、只保留最新待處理影格、停止釋放資源',async t=>{
  const original=new Map(),put=(key,value)=>{original.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,value})};
  t.after(()=>{for(const [key,d] of original)if(d)Object.defineProperty(globalThis,key,d);else delete globalThis[key]});
  let worker=null,scheduled=null,stopped=false,ready=null;const results=[],bitmaps=[];
  const track={stop(){stopped=true},getSettings:()=>({width:1280,height:720,frameRate:30})};
  const stream={getVideoTracks:()=>[track],getTracks:()=>[track]};
  put('navigator',{mediaDevices:{getUserMedia:async options=>{assert.equal(options.audio,false);return stream}}});
  put('window',{});put('fetch',async()=>({ok:true}));
  put('Worker',class{sent=[];constructor(){worker=this}postMessage(msg){this.sent.push(msg)}terminate(){this.ended=true}});
  put('createImageBitmap',async()=>{const b={close(){this.closed=true}};bitmaps.push(b);return b});
  const video={videoWidth:1280,videoHeight:720,async play(){},requestVideoFrameCallback(f){scheduled=f;return 7},cancelVideoFrameCallback(){scheduled=null}};
  const cam=new Camera(video,r=>results.push(r),m=>assert.fail(m),s=>ready=s);t.after(()=>cam.stop());
  await cam.start();assert.equal(worker.sent[0].type,'init');worker.onmessage({data:{type:'ready'}});assert.equal(ready.frameRate,30);
  for(let i=1;i<=3;i++)await scheduled(i*30,{presentationTime:i*30});
  assert.deepEqual(worker.sent.filter(m=>m.type==='frame').map(f=>f.seq),[1]);assert.equal(bitmaps[1].closed,true);
  worker.onmessage({data:{type:'result',seq:1,t:30,hands:[],inferMs:2}});
  assert.deepEqual(worker.sent.filter(m=>m.type==='frame').map(f=>f.seq),[1,3]);assert.equal(results.length,1);
  cam.stop();assert.ok(stopped&&worker.ended);assert.equal(video.srcObject,null);assert.equal(scheduled,null);
});

