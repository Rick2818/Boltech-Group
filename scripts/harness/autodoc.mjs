#!/usr/bin/env node
// Harness AutoDoc: deterministic, no AI services or external messages.
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:8*1024*1024}).trim();
const sha=git('rev-parse','HEAD');
const parent=git('rev-parse',sha+'^');
const changed=git('diff','--name-only',parent,sha).split('\n').filter(Boolean)
 .filter(p=>!p.startsWith('docs/harness/events/'));
const author=git('log','-1','--format=%an');
const subject=git('log','-1','--format=%s');
const date=git('log','-1','--format=%aI');
const record={schemaVersion:1,commit:sha,parent,author,subject,date,files:changed,
  evidence:{checks:'NOT_VERIFIED',preview:'NOT_VERIFIED',production:'NOT_VERIFIED',certification:'NOT_CERTIFIED'},
  note:'Generated from Git commit metadata. Tests, deploy and business outcomes require separate verified receipts.'};
const dir='docs/harness/events',file=join(dir,sha+'.json');
mkdirSync(dir,{recursive:true});
if(!existsSync(file))writeFileSync(file,JSON.stringify(record,null,2)+'\n');
console.log('HARNESS_EVENT='+file);
