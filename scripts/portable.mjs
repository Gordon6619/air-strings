import {readFile,writeFile} from 'node:fs/promises';
const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');
const names=['core','gesture','audio','camera','resonance','canon','concert','app'];
const parts=[];
for(const key of names){
  let code=await read('public/'+key+'.js');
  const exports=[...code.matchAll(/\bexport\s+(?:class|function|const)\s+(\w+)/g)].map(m=>m[1]);
  code=code.replace(/import\s*\{([^}]+)\}\s*from\s*'\.\/(\w+)\.js(?:\?[^']+)?';/g,(_,symbols,dep)=>'const {'+symbols+'}=modules.'+dep+';');
  code=code.replace(/\bexport\s+(?=class|function|const)/g,'');
  parts.push('modules.'+key+'=(()=>{\n'+code+'\nreturn {'+exports.join(',')+'};\n})();');
}
const worker=await read('public/tracking-worker.js'),lock=await read('camera-assets.lock.json');
const script=await read('scripts/portable-runtime.js')+'\nwindow.airStringsPortable=portableRuntime('+lock+','+JSON.stringify(worker)+');\nconst modules={};\n'+parts.join('\n');
const css=await read('public/style.css');
const html=(await read('public/index.html')).replace(/<link rel="stylesheet" href="style\.css(?:\?[^"]*)?">/,()=>'<style>'+css+'</style>').replace(/<script type="module" src="app\.js(?:\?[^"]*)?"><\/script>/,()=>'<script type="module">'+script.replace(/<\/script/gi,'<\\/script')+'</script>');
await writeFile(new URL('../Air-Strings.html',import.meta.url),html);
