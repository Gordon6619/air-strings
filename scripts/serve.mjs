import http from 'node:http';
import {stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=fileURLToPath(new URL('../public/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.wasm':'application/wasm','.task':'application/octet-stream'};
let preparing;
function prepareCamera(){
  if(!preparing)preparing=new Promise((done,reject)=>{
    const child=spawn(process.execPath,[fileURLToPath(new URL('./install-camera.mjs',import.meta.url))],{stdio:'inherit',windowsHide:true});
    child.once('error',reject);child.once('exit',code=>code===0?done():reject(Error('Install failed')));
  }).finally(()=>{preparing=null});
  return preparing;
}
const server=http.createServer(async(req,res)=>{
  try{
    if(req.method==='POST'&&req.url==='/prepare-camera'){
      const origin='http://127.0.0.1:'+server.address().port;
      if(req.headers.origin!==origin||req.headers['x-air-strings']!=='prepare'){res.writeHead(403).end();return}
      try{await prepareCamera();res.writeHead(204).end()}catch{res.writeHead(503).end('Camera assets unavailable')}
      return;
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return}
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(path.includes('\\')||path.split('/').some(s=>s.startsWith('.'))){res.writeHead(404).end();return}
    const file=resolve(root,'.'+(path==='/'?'/index.html':path));
    if(!file.startsWith(resolve(root)+sep)){res.writeHead(404).end();return}
    const info=await stat(file);if(!info.isFile())throw Error();
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD')res.end();else createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  }catch{res.writeHead(404).end('Not found')}
});
let port=Number(process.env.AIR_STRINGS_PORT||4173);
server.on('error',e=>{if(e.code==='EADDRINUSE'&&process.argv.includes('--open')){server.listen(0,'127.0.0.1');return}console.error(e.message);process.exitCode=1});
server.on('listening',()=>{const url='http://127.0.0.1:'+server.address().port+'/';console.log('Air Strings  '+url+'  (Ctrl+C to stop)');
  if(process.argv.includes('--open')&&process.platform==='win32')spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true,stdio:'ignore'}).unref();
});
server.listen(port,'127.0.0.1');

