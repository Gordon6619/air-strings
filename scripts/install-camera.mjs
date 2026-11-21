import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readFile,writeFile,mkdir,rename,mkdtemp,rm,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),pub=join(root,'public'),dest=join(pub,'vendor');
const lock=JSON.parse(await readFile(join(root,'camera-assets.lock.json'),'utf8'));
const hash=(b,alg,format)=>createHash(alg).update(b).digest(format);
async function source(url,local){
  if(local)return readFile(resolve(local));
  console.log('Downloading '+url);
  const res=await fetch(url,{signal:AbortSignal.timeout(120000)});
  if(!res.ok)throw Error('Download failed: HTTP '+res.status);
  return Buffer.from(await res.arrayBuffer());
}
async function valid(){
  try{const m=JSON.parse(await readFile(join(dest,'ready.json'),'utf8'));
    if(m.sdk!==lock.sdk.version||m.model!==lock.model.sha256)return false;
    for(const f of required){const b=await readFile(join(dest,f));if(hash(b,'sha256','hex')!==m.files[f])return false}return true;
  }catch{return false}
}
const required=['hand_landmarker.task','vision_bundle.mjs','wasm/vision_wasm_internal.js','wasm/vision_wasm_internal.wasm','wasm/vision_wasm_nosimd_internal.js','wasm/vision_wasm_nosimd_internal.wasm'];
async function install(){
  if(await valid()){console.log('Camera assets ready.');return}
  const [tgz,model]=await Promise.all([source(lock.sdk.url,process.argv[2]),source(lock.model.url,process.argv[3])]);
  if(hash(tgz,'sha512','base64')!==lock.sdk.sha512||hash(model,'sha256','hex')!==lock.model.sha256)throw Error('Asset checksum mismatch');
  const tar=gunzipSync(tgz),files=new Map([['hand_landmarker.task',model]]);
  for(let pos=0;pos+512<=tar.length;){
    const path=tar.toString('utf8',pos,pos+100).split('\0')[0];if(!path)break;
    const size=parseInt(tar.toString('ascii',pos+124,pos+136),8);
    if(!Number.isSafeInteger(size)||size<0||pos+512+size>tar.length)throw Error('Invalid npm archive');
    const name=path.replace(/^package\//,'');
    if(required.includes(name)||/^LICENSE(?:\.txt)?$/i.test(name))files.set(name,tar.subarray(pos+512,pos+512+size));
    pos+=512+Math.ceil(size/512)*512;
  }
  if(required.some(f=>!files.has(f)))throw Error('Required model runtime missing in npm archive');
  const tmp=await mkdtemp(join(pub,'.install-'));
  try{
    await mkdir(join(tmp,'wasm'));const sums={};
    for(const [f,b] of files){await writeFile(join(tmp,f),b);sums[f]=hash(b,'sha256','hex')}
    await writeFile(join(tmp,'ready.json'),JSON.stringify({sdk:lock.sdk.version,model:lock.model.sha256,files:sums}));
    let exists=true;try{await access(dest)}catch{exists=false}
    if(exists){if(await valid())return;await rename(dest,join(pub,'.previous-vendor-'+Date.now()))}
    await rename(tmp,dest);console.log('Offline camera runtime is ready.');
  }finally{await rm(tmp,{recursive:true,force:true})}
}
try{await install()}catch(e){console.error(e.message,e.cause?.code??'');process.exitCode=1}

