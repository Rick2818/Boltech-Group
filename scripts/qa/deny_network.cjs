// Loaded before application modules. QA never imports production credentials.
const safeEnv=new Set(['PATH','LANG','LC_ALL','TZ','TMPDIR','TMP','TEMP']);
for(const key of Object.keys(process.env))if(!safeEnv.has(key))delete process.env[key];
const deny = () => { throw Object.assign(new Error('QA_NETWORK_DENIED'), {code:'QA_NETWORK_DENIED'}); };
globalThis.__BOLTECH_QA_NETWORK_DENIED = true;
globalThis.fetch = async () => deny();
for (const name of ['node:http','node:https']) { const m=require(name);m.request=deny;m.get=deny; }
const net=require('node:net');net.connect=deny;net.createConnection=deny;net.Socket.prototype.connect=deny;
const udp=require('node:dgram');udp.createSocket=deny;
for(const name of ['node:dns','node:dns/promises']){const dns=require(name);for(const key of Object.keys(dns))if(/^(?:lookup|resolve|reverse)/.test(key)&&typeof dns[key]==='function')dns[key]=deny;if(dns.Resolver)for(const key of Object.getOwnPropertyNames(dns.Resolver.prototype))if(/^(?:resolve|reverse|setServers)/.test(key))dns.Resolver.prototype[key]=deny;}
const child=require('node:child_process');for(const key of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])child[key]=deny;
require('node:module').syncBuiltinESMExports();
