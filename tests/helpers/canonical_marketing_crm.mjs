// In-memory REST fixture with equality/CAS filtering, independent of material logic.
export function canonicalCrm({leads=[],jobs=[]}={}){
 const work=new Map(),briefs=new Map();let attempts=0;
 const db=async(raw,options={})=>{
  const u=new URL('https://db.test'+raw),table=u.pathname.slice(1),method=options.method||'GET';
  if(table==='leads')return structuredClone(leads.slice(Number(u.searchParams.get('offset')||0),Number(u.searchParams.get('offset')||0)+Number(u.searchParams.get('limit')||1000)));
  if(table==='agent1_inbound_sales_jobs')return structuredClone(jobs);
  const map=table==='agent_work'?work:table==='marketing_sales_briefs'?briefs:null;
  if(!map)throw Error('UNEXPECTED_TABLE '+table);
  if(method==='POST'){for(const row of JSON.parse(options.body)){const key=row.work_id||row.id;if(options.headers?.Prefer?.includes('ignore-duplicates')&&map.has(key))continue;map.set(key,structuredClone(row));}return null;}
  let rows=[...map.values()];
  for(const [key,val] of u.searchParams){if(['select','offset','limit','order','on_conflict'].includes(key))continue;if(val.startsWith('eq.'))rows=rows.filter(r=>String(r[key])===val.slice(3));else if(val==='is.null')rows=rows.filter(r=>r[key]==null);else if(val.startsWith('like.'))rows=rows.filter(r=>String(r[key]).startsWith(val.slice(5).replace(/\*$/,'')));}
  if(method==='PATCH'){attempts++;for(const row of rows)Object.assign(row,JSON.parse(options.body));}
  const offset=Number(u.searchParams.get('offset')||0),limit=Number(u.searchParams.get('limit')||1000);
  return structuredClone(rows.slice(offset,offset+limit));
 };
 return {db,work,briefs,leads,jobs,get attempts(){return attempts;}};
}
