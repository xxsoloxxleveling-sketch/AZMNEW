import {build} from 'esbuild';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
await build({entryPoints:[resolve(root,'native/scanner-entry.js')],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:resolve(root,'native-bridge.js'),minify:true});
console.log('Android Google Code Scanner bridge bundled. Run npm run build, then npx cap sync android.');
