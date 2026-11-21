export class Camera {
  constructor(video,onFrame,onError,onReady){Object.assign(this,{video,onFrame,onError,onReady});this.generation=0}
  stop(){
    ++this.generation;clearTimeout(this.timer);clearInterval(this.watch);
    if(this.callback)this.video.cancelVideoFrameCallback(this.callback);
    this.worker?.terminate();this.worker=null;this.pending?.bitmap.close();this.pending=null;
    this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.video.srcObject=null;
  }
  async start(){
    this.stop();const run=this.generation;const current=()=>run===this.generation;
    const fail=msg=>{if(current())this.onError(msg)};
    const portable=window.airStringsPortable;
    const assets=portable?await portable.prepare():null;
    const res=portable?null:await fetch('./vendor/ready.json',{cache:'no-store'});
    if(res&&!res.ok){
      if(!current())return;
      const setup=await fetch('./prepare-camera',{method:'POST',headers:{'X-Air-Strings':'prepare'}});
      if(!setup.ok)throw Error('無法下載手部模型。請確認網路後重試，或執行 Install-Camera.cmd；滑鼠演奏可離線使用。');
    }
    if(!current())return;
    if(!navigator.mediaDevices?.getUserMedia)throw Error('請透過 localhost 或 HTTPS 開啟並允許攝影機。');
    const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}},audio:false});
    if(!current()){stream.getTracks().forEach(t=>t.stop());return}
    this.stream=stream;const track=stream.getVideoTracks()[0];track.onended=()=>fail('攝影機連線中斷，請接回後重新啟動。');
    this.video.srcObject=stream;await this.video.play();if(!current())return;
    const worker=this.worker=new Worker(portable?.workerUrl||'./tracking-worker.js');
    let busy=false,capturing=false,seq=0,lastInput=performance.now(),lastResult=lastInput;
    let lastCapture=-1;
    // Resize only the inference copy. Keep the displayed video at native resolution.
    let inferenceEdge=960,averageInference=0,framesSinceChange=0;
    const send=frame=>{busy=true;worker.postMessage({type:'frame',...frame},[frame.bitmap])};
    const capture=async(now,meta)=>{
      if(!current())return;this.callback=this.video.requestVideoFrameCallback(capture);
      if(capturing)return;capturing=true;
      try{
        const ts=Number.isFinite(meta.captureTime)?meta.captureTime:meta.presentationTime??now;
        if(ts<=lastCapture)return;
        lastCapture=ts;lastInput=performance.now();
        const ratio=Math.min(1,inferenceEdge/Math.max(this.video.videoWidth,this.video.videoHeight));
        const bitmap=ratio<1?await createImageBitmap(this.video,{
          resizeWidth:Math.max(1,Math.round(this.video.videoWidth*ratio)),
          resizeHeight:Math.max(1,Math.round(this.video.videoHeight*ratio)),resizeQuality:'low'
        }):await createImageBitmap(this.video);
        if(!current()){bitmap.close();return}
        const frame={bitmap,t:ts,seq:++seq};
        if(busy){this.pending?.bitmap.close();this.pending=frame}else send(frame);
      }catch(e){fail('攝影影格讀取失敗：'+e.message)}finally{capturing=false}
    };
    worker.onerror=e=>fail('辨識引擎無法執行：'+e.message);
    this.timer=setTimeout(()=>fail('辨識引擎啟動逾時，請重新啟動攝影機。'),30000);
    worker.onmessage=({data})=>{
      if(!current())return;
      if(data.type==='error'){fail('手部辨識失敗：'+data.message);return}
      if(data.type==='ready'){
        clearTimeout(this.timer);this.onReady({...track.getSettings(),width:this.video.videoWidth,height:this.video.videoHeight,cacheWarning:assets?.cacheWarning});
        lastInput=lastResult=performance.now();
        this.callback=this.video.requestVideoFrameCallback(capture);
        this.watch=setInterval(()=>{const now=performance.now();if(now-lastInput>2500||now-lastResult>4000)fail('影像追蹤暫停，請重新啟動攝影機。');},500);
      }else if(data.type==='result'){
        averageInference=averageInference?0.9*averageInference+0.1*data.inferMs:data.inferMs;
        if(++framesSinceChange>=24&&averageInference>35&&inferenceEdge>640){
          inferenceEdge-=160;framesSinceChange=0;
        }else if(framesSinceChange>=120&&averageInference<17&&inferenceEdge<960){
          inferenceEdge+=160;framesSinceChange=0;
        }
        busy=false;lastResult=performance.now();this.onFrame(data);
        if(current()&&this.pending){const f=this.pending;this.pending=null;send(f)}
      }
    };
    worker.postMessage({type:'init',assets});
  }
}

