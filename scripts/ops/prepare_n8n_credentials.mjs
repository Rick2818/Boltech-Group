import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
const dir='scratch/commercial-scale/n8n-runtime';await mkdir(dir,{recursive:true});
let auth;try{auth=JSON.parse(await readFile(`${dir}/client-auth.json`,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;auth={key:randomBytes(32).toString('hex')};await writeFile(`${dir}/client-auth.json`,JSON.stringify(auth),{flag:'wx',mode:0o600});}
await writeFile(`${dir}/credential-import.json`,JSON.stringify([{id:'boltechInteragentHeader',name:'Boltech interagent local',type:'httpHeaderAuth',data:{name:'X-Boltech-Agent-Key',value:auth.key}}]),{mode:0o600});
console.log(JSON.stringify({credentialPrepared:true,secretsPrinted:false,localOnly:true}));
