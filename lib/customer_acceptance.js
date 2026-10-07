// Reject conditions added to an acceptance, quoted/forwarded text and automatic replies.
// Ignore only the quoted original email or the conventional signature separator.
export function acceptanceBody(text){
 if(typeof text!=='string'||text.length>100000)return '';
 const lines=text.split(/\r?\n/),result=[];
 for(const line of lines){if(/^\s*(>|On .+wrote:|El .+escribi[oó]:|--\s*$)/i.test(line))break;result.push(line);}
 return result.join('\n').trim();
}
