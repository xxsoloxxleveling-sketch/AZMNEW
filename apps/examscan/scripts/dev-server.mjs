import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,relative,extname,sep} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const PORT=Number(process.env.PORT)||8080;
const mime={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.json':'application/json; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  try{
    const path=new URL(req.url,'http://localhost').pathname;
    const full=resolve(root,'.'+(path==='/'?'/index.html':path));
    const rel=relative(root,full);
    if(rel.startsWith('..'+sep)||rel==='..'||rel.startsWith('tests'+sep)||rel.startsWith('scripts'+sep)||rel.startsWith('native'+sep)||rel.startsWith('dist'+sep)||['README.md','SECURITY.md','package.json','capacitor.config.json'].includes(rel)){
      res.writeHead(404);res.end('Not found');return;
    }
    const data=await readFile(full);const info=await stat(full);
    if(!info.isFile())throw new Error('Not a file');
    res.writeHead(200,{'Content-Type':mime[extname(full)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
    res.end(data);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(PORT,'127.0.0.1',()=>console.log(`ExamScan local preview: http://127.0.0.1:${PORT} (synthetic testing only; server does not proxy backend requests)`));
