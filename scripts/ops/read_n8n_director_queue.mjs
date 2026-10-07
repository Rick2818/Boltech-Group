import {spawnSync} from 'node:child_process';
const operation=process.argv[2]||'queue';
if(!['queue','acknowledge'].includes(operation))throw Error('Use acknowledge with an evidence JSON file; a bare event ID cannot prove notification');
if(operation==='acknowledge'&&!process.argv[3])throw Error('Notification receipt and verification JSON file required');
const result=spawnSync(process.execPath,['scripts/ops/interagent_control.mjs',operation,...(process.argv[3]?[process.argv[3]]:[])],{stdio:'inherit'});
if(result.error)throw result.error;process.exitCode=result.status??1;
