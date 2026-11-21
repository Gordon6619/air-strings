let detector;
self.onmessage=async({data})=>{
  if(data.type==='init'){
    try{
      const assets=data.assets;
      const root=assets?null:new URL('./vendor/',self.location.href);
      const {FilesetResolver,HandLandmarker}=await import(assets?assets['vision_bundle.mjs']:new URL('vision_bundle.mjs',root).href);
      const kind=assets&&!(await FilesetResolver.isSimdSupported())?'nosimd_internal':'internal';
      const files=assets?{wasmLoaderPath:assets['wasm/vision_wasm_'+kind+'.js'],wasmBinaryPath:assets['wasm/vision_wasm_'+kind+'.wasm']}:await FilesetResolver.forVisionTasks(new URL('wasm',root).href);
      const model=assets?assets.model:new URL('hand_landmarker.task',root).href;
      detector=await HandLandmarker.createFromOptions(files,{canvas:new OffscreenCanvas(1,1),baseOptions:{modelAssetPath:model,delegate:'CPU'},runningMode:'VIDEO',numHands:2});
      self.postMessage({type:'ready'});
    }catch(e){self.postMessage({type:'error',message:String(e.message||e)})}
  }else if(data.type==='frame'){
    const start=performance.now();
    try{const result=detector.detectForVideo(data.bitmap,data.t);
      self.postMessage({type:'result',seq:data.seq,t:data.t,hands:result.landmarks,inferMs:performance.now()-start});
    }catch(e){self.postMessage({type:'error',message:String(e.message||e)})}
    finally{data.bitmap.close()}
  }
};

