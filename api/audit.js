import { db, json } from './_db.js';
import { requireUser, canAccessSite } from './_auth.js';
export default async function handler(req,res){
  if(req.method!=='GET') return json(res,405,{error:'Method not allowed.'});
  try{
    const user=await requireUser(req,res); if(!user)return;
    const site=req.query?.site||'';
    const period=req.query?.period||req.query?.month||'';
    const type=String(req.query?.type||'monthly').toLowerCase();
    if(!site||!period||!['monthly','annual'].includes(type))return json(res,400,{error:'site, type and period are required.'});
    if(!canAccessSite(user,site))return json(res,403,{error:'You are not authorised to view this site.'});
    const rows=await db()`SELECT * FROM five_s_audits WHERE site=${site} AND audit_month=${period} AND audit_type=${type} LIMIT 1`;
    if(!rows.length)return json(res,404,{error:`No saved ${type} audit found for this site/period.`});
    return json(res,200,{audit:rows[0]});
  }catch(e){console.error(e);return json(res,500,{error:e.message||'Could not load audit.'});}
}
