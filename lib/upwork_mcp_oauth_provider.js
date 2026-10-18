import { randomBytes } from 'node:crypto';
import { decryptUpworkTokens, encryptUpworkTokens } from './upwork_oauth.js';

export const UPWORK_MCP_VAULT_KEY = 'boltech:upwork:mcp-oauth:v1';

export class UpworkMcpOAuthProvider {
  constructor({ redis, vaultKey, redirectUrl='http://127.0.0.1:8765/oauth/callback', onAuthorizationUrl=()=>{} }={}) {
    if (!redis || typeof redis.get !== 'function' || typeof redis.set !== 'function') {
      throw Object.assign(new Error('UPWORK_MCP_DURABLE_STORE_REQUIRED'), { code:'UPWORK_MCP_DURABLE_STORE_REQUIRED' });
    }
    if (!vaultKey || String(vaultKey).length < 32) {
      throw Object.assign(new Error('UPWORK_MCP_VAULT_KEY_REQUIRED'), { code:'UPWORK_MCP_VAULT_KEY_REQUIRED' });
    }
    this.redis=redis;
    this.vaultKey=String(vaultKey);
    this.redirectUrl=redirectUrl;
    this.onAuthorizationUrl=onAuthorizationUrl;
    this.pendingState='';
  }

  get clientMetadata() {
    return {
      client_name:'Boltech Agent 1 read-only freelance search',
      redirect_uris:[this.redirectUrl],
      grant_types:['authorization_code','refresh_token'],
      response_types:['code'],
      token_endpoint_auth_method:'none',
      application_type:this.redirectUrl.startsWith('http://127.0.0.1:')?'native':'web'
    };
  }

  async #read() {
    let stored=await this.redis.get(UPWORK_MCP_VAULT_KEY);
    if (typeof stored==='string') { try { stored=JSON.parse(stored); } catch { stored=null; } }
    if (!stored) return {};
    return decryptUpworkTokens(stored,this.vaultKey);
  }

  async #write(patch) {
    const next={...(await this.#read()),...patch};
    const encrypted=encryptUpworkTokens(next,this.vaultKey);
    const result=await this.redis.set(UPWORK_MCP_VAULT_KEY,encrypted);
    if (result!==undefined && result!==null && result!=='OK' && result!==true) {
      throw Object.assign(new Error('UPWORK_MCP_VAULT_WRITE_FAILED'), { code:'UPWORK_MCP_VAULT_WRITE_FAILED' });
    }
  }

  async clientInformation() { return (await this.#read()).clientInformation; }
  async saveClientInformation(clientInformation) { await this.#write({clientInformation}); }
  async tokens() { return (await this.#read()).tokens; }
  async saveTokens(tokens) { await this.#write({tokens,tokenSavedAt:new Date().toISOString()}); }
  async hasStoredAuthorization() {
    const stored=await this.#read();
    return Boolean(stored.clientInformation?.client_id && stored.tokens?.access_token);
  }
  state() { this.pendingState=randomBytes(32).toString('base64url'); return this.pendingState; }
  currentState() { return this.pendingState; }
  async saveCodeVerifier(codeVerifier) { await this.#write({codeVerifier}); }
  async codeVerifier() { const value=(await this.#read()).codeVerifier; if (!value) throw new Error('UPWORK_MCP_CODE_VERIFIER_MISSING'); return value; }
  async saveDiscoveryState(discoveryState) { await this.#write({discoveryState}); }
  async discoveryState() { return (await this.#read()).discoveryState; }
  async invalidateCredentials(scope='all') {
    if (scope==='all') return this.redis.del(UPWORK_MCP_VAULT_KEY);
    const old=await this.#read();
    if (scope==='tokens') delete old.tokens;
    else if (scope==='client') { delete old.clientInformation; delete old.tokens; }
    else if (scope==='verifier') delete old.codeVerifier;
    else if (scope==='discovery') delete old.discoveryState;
    await this.redis.set(UPWORK_MCP_VAULT_KEY,encryptUpworkTokens(old,this.vaultKey));
  }
  redirectToAuthorization(url) { this.onAuthorizationUrl(url); }
}
