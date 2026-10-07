import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {runN8nMessage} from '../../lib/n8n_message_client.js';
const path=process.argv[2];if(!path)throw Error('Provide local event JSON path');
const event=JSON.parse(await readFile(path,'utf8'));
const dir='scratch/commercial-scale/interagent-ledger';await mkdir(dir,{recursive:true});
const file=`${dir}/${createHash('sha256').update(event.eventId||'').digest('hex')}.json`;
const runtime=JSON.parse(await readFile('scratch/commercial-scale/n8n-runtime/client-auth.json','utf8'));
const store={
 read:async()=>{try{return JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}},
 reserve:record=>writeFile(file,JSON.stringify(record),{flag:'wx',mode:0o600}),
 save:async record=>{const temporary=file+'.'+randomUUID()+'.tmp';await writeFile(temporary,JSON.stringify(record,null,2),{flag:'wx',mode:0o600});await rename(temporary,file);}
};
const {result,exitCode}=await runN8nMessage({event,runtime,store,reconcile:process.argv.includes('--reconcile')});
console.log(JSON.stringify(result));process.exitCode=exitCode;
