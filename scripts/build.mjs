import {build} from 'esbuild';import {mkdir,cp,readFile,writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
await mkdir('dist/server',{recursive:true});await cp('public','dist/client',{recursive:true});
await build({entryPoints:['cloud/worker.mjs'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/server/index.js',sourcemap:false,minify:false});
console.log('Built private Sites Worker and client assets. No deployment performed.');
