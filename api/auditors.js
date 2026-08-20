import { db, json } from './_db.js';
import { requireUser } from './_auth.js';
export default async function handler(req,res){
  try{
    const user=await requireUser(req,res); if(!user)return;
    if(req.method!=='GET') return json(res,405,{error:'Method not allowed.'});
    const sql=db();
    const rows=await sql`SELECT u.full_name, u.role,
      COALESCE(array_agg(usa.site ORDER BY usa.site) FILTER (WHERE usa.site IS NOT NULL),'{}') sites
      FROM five_s_users u LEFT JOIN five_s_user_sites usa ON usa.user_id=u.id
      WHERE u.is_active=TRUE AND u.role IN ('internal','external')
      GROUP BY u.id ORDER BY u.full_name`;
    return json(res,200,{auditors:rows});
  }catch(e){console.error(e);return json(res,500,{error:e.message||'Could not load auditors.'});}
}
