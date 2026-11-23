import {stripTypeScriptTypes} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
for(const name of ['core','gesture']){
  const code=await readFile(new URL('../src/'+name+'.ts',import.meta.url),'utf8');
  const js=stripTypeScriptTypes(code,{mode:'strip'}).replace(/^[ \t]+$/gm,'');
  await writeFile(new URL('../public/'+name+'.js',import.meta.url),'// Generated from src/'+name+'.ts by npm run build.\n'+js);
}
await import('./portable.mjs');
