/* Included by the build in Air-Strings.html. Only the pinned public SDK and model are requested. */
function portableRuntime(lock,workerSource){
  let prepared=null;
  const bytesToHex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
  const required=['vision_bundle.mjs','wasm/vision_wasm_internal.js','wasm/vision_wasm_internal.wasm','wasm/vision_wasm_nosimd_internal.js','wasm/vision_wasm_nosimd_internal.wasm'];
  async function db(){
    return new Promise((ok,no)=>{const req=indexedDB.open('air-strings-camera-v1',1);
      req.onupgradeneeded=()=>req.result.createObjectStore('runtime');
      req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error);});
  }
  async function cache(value){
    const store=await db();const key=lock.sdk.version+'-'+lock.model.sha256;
    try{return await new Promise((ok,no)=>{
      const tx=store.transaction('runtime',value?'readwrite':'readonly');
      const req=value?tx.objectStore('runtime').put(value,key):tx.objectStore('runtime').get(key);
      tx.oncomplete=()=>ok(req.result);tx.onabort=tx.onerror=()=>no(tx.error);
    })}finally{store.close()}
  }
  async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error('下載失敗 HTTP '+r.status);return r.arrayBuffer()}
  async function unpack(pair){
    const [sdk,model]=pair;
    const sha=await crypto.subtle.digest('SHA-512',sdk), mh=await crypto.subtle.digest('SHA-256',model);
    if(btoa(String.fromCharCode(...new Uint8Array(sha)))!==lock.sdk.sha512||bytesToHex(mh)!==lock.model.sha256)throw Error('辨識檔案完整性驗證失敗');
    const bytes=new Uint8Array(await new Response(new Blob([sdk]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    const decoder=new TextDecoder(),files={};
    for(let i=0;i+512<=bytes.length;){
      const path=decoder.decode(bytes.subarray(i,i+100)).split('\0')[0];if(!path)break;
      const size=parseInt(decoder.decode(bytes.subarray(i+124,i+136)),8);
      if(!Number.isSafeInteger(size)||size<0||i+512+size>bytes.length)throw Error('套件格式錯誤');
      const name=path.replace(/^package\//,'');
      if(required.includes(name))files[name]=URL.createObjectURL(new Blob([bytes.slice(i+512,i+512+size)],{type:name.endsWith('.wasm')?'application/wasm':'text/javascript'}));
      i+=512+Math.ceil(size/512)*512;
    }
    if(required.some(n=>!files[n]))throw Error('辨識套件缺少檔案');
    files.model=URL.createObjectURL(new Blob([model]));return files;
  }
  async function prepare(){
    let pair;try{pair=await cache()}catch{}
    if(pair){try{return await unpack(pair)}catch{/* Replace an incomplete cache with verified original assets. */}}
    try{pair=await Promise.all([get(lock.sdk.url),get(lock.model.url)])}catch{throw Error('首次啟用攝影機需能連線至 npm 與 Google。可先用滑鼠演奏，或在桌面版執行 Install-Camera.cmd。')}
    const files=await unpack(pair);
    try{await cache(pair)}catch{files.cacheWarning='本次可演奏，但瀏覽器未能保存離線模型。'}
    return files;
  }
  const workerUrl=URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'}));
  return {workerUrl,prepare:()=>prepared??=(prepare().catch(e=>{prepared=null;throw e}))};
}

