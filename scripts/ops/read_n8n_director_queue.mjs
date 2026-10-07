import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
const dir='scratch/commercial-scale/interagent-ledger';await mkdir(dir,{recursive:true});
const mark=process.argv[2];const pending=[];
for(const name of await readdir(dir)){
 if(!name.endsWith('.json'))continue;
 const path=`${dir}/${name}`,row=JSON.parse(await readFile(path,'utf8'));
 if(mark&&row.eventId===mark){row.directorReviewedAt=new Date().toISOString();await writeFile(path,JSON.stringify(row,null,2));}
 if(row.status==='RECEIVED'&&row.response?.to==='DIRECTORA'&&!row.directorReviewedAt&&!/^qa[-:]/i.test(row.eventId))pending.push({eventId:row.eventId,at:row.at,...row.response});
}
console.log(JSON.stringify({queue:'DIRECTORA',pending,definition:'Reported events; director must verify evidence and notify Ricardo before marking reviewed.'}));
