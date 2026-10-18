// Loaded before application modules. QA never imports production credentials.
for (const key of Object.keys(process.env)) if (/TOKEN|SECRET|API_KEY|AIRTABLE|UPSTASH|REDIS|WOMPI|DATABASE_URL|PGPASSWORD/i.test(key)) delete process.env[key];
const deny = () => { throw Object.assign(new Error('QA_NETWORK_DENIED'), {code:'QA_NETWORK_DENIED'}); };
globalThis.fetch = async () => deny();
for (const name of ['node:http','node:https']) { const m=require(name);m.request=deny;m.get=deny; }
const net=require('node:net');net.connect=deny;net.createConnection=deny;net.Socket.prototype.connect=deny;
const child=require('node:child_process');for(const key of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])child[key]=deny;
require('node:module').syncBuiltinESMExports();
