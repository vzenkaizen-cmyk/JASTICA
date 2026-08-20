import bcrypt from 'bcryptjs';
import { db, json, readBody } from './_db.js';

export default async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{error:'Method not allowed.'});
  try{
    const b=await readBody(req);
    const fullName=String(b.full_name||'').trim();
    const username=String(b.username||'').trim().toLowerCase();
    const password=String(b.password||'');
    const sites=Array.isArray(b.sites) ? [...new Set(b.sites.map(s=>String(s).trim().toUpperCase()).filter(Boolean))] : [];
    if(!fullName||!username||!password) return json(res,400,{error:'Full name, username and password are required.'});
    if(password.length<8) return json(res,400,{error:'Password must contain at least 8 characters.'});
    if(!sites.length) return json(res,400,{error:'Select at least one assigned plant/site.'});

    const sql=db();
    const siteRows=await sql`SELECT site FROM five_s_sites WHERE is_active=TRUE AND site = ANY(${sites})`;
    const allowed=new Set(siteRows.map(r=>r.site));
    const invalid=sites.filter(s=>!allowed.has(s));
    if(invalid.length) return json(res,400,{error:`Unknown or inactive plant/site: ${invalid.join(', ')}`});

    const exists=await sql`SELECT id FROM five_s_users WHERE lower(username)=lower(${username}) LIMIT 1`;
    if(exists.length) return json(res,409,{error:'That username is already registered.'});
    const hash=await bcrypt.hash(password,12);
    const rows=await sql`INSERT INTO five_s_users(username,full_name,password_hash,role,is_active) VALUES(${username},${fullName},${hash},'external',TRUE) RETURNING id,username,full_name,role`;
    for(const site of sites) await sql`INSERT INTO five_s_user_sites(user_id,site) VALUES(${rows[0].id},${site}) ON CONFLICT DO NOTHING`;
    return json(res,201,{user:rows[0],sites});
  }catch(e){console.error(e);return json(res,500,{error:e.message||'Sign up failed.'});}
}
