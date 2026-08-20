import { db, json, readBody } from './_db.js';
import { requireUser, canAccessSite } from './_auth.js';

function validType(v){ return v==='monthly' || v==='annual'; }
function validPeriod(type,v){ return type==='annual' ? /^\d{4}$/.test(v) : /^\d{4}-\d{2}$/.test(v); }

export default async function handler(req, res) {
  try {
    const user = await requireUser(req,res); if (!user) return;
    const sql = db();

    if (req.method === 'GET') {
      const site = req.query?.site || '';
      if (site && !canAccessSite(user, site)) return json(res,403,{error:'You are not authorised to view this site.'});
      const rows = site
        ? await sql`SELECT id, organisation, site, department, audit_month, audit_type, auditor, auditor_type, overall_total, saved_at, updated_at FROM five_s_audits WHERE site=${site} ORDER BY audit_month DESC, audit_type, updated_at DESC`
        : user.role === 'admin'
          ? await sql`SELECT id, organisation, site, department, audit_month, audit_type, auditor, auditor_type, overall_total, saved_at, updated_at FROM five_s_audits ORDER BY audit_month DESC, audit_type, updated_at DESC`
          : await sql`SELECT id, organisation, site, department, audit_month, audit_type, auditor, auditor_type, overall_total, saved_at, updated_at FROM five_s_audits WHERE site = ANY(${user.sites}) ORDER BY audit_month DESC, audit_type, updated_at DESC`;
      return json(res,200,{audits:rows});
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const { site, audit_month, audit_type, audit } = body;
      const type=String(audit_type||'monthly').toLowerCase();
      if (!site || !audit_month || !audit || !validType(type) || !validPeriod(type,String(audit_month))) {
        return json(res,400,{error:'Valid site, audit type, period and audit data are required.'});
      }
      if (!canAccessSite(user, site)) return json(res,403,{error:'You are not authorised to save an audit for this site.'});
      const auditorType = 'External Auditor';
      const auditor = user.full_name;
      const overallTotal = Number(body.overall_total || 0);
      const rows = await sql`
        INSERT INTO five_s_audits
          (organisation, site, department, audit_month, audit_type, auditor, auditor_type, scores, section_notes, q14, special_note, signature, overall_total, saved_at, updated_at, created_by)
        VALUES
          ('JASTICA', ${site}, ${audit.meta?.dept || null}, ${audit_month}, ${type}, ${auditor}, ${auditorType},
           ${JSON.stringify(audit.scores || {})}::jsonb, ${JSON.stringify(audit.sectionNotes || {})}::jsonb,
           ${JSON.stringify(audit.q14 || {text:{},score:{}})}::jsonb, ${audit.specialNote || ''},
           ${JSON.stringify(audit.signature || {dataUrl:'',signedAt:null})}::jsonb, ${overallTotal}, NOW(), NOW(), ${user.id})
        ON CONFLICT (site, audit_type, audit_month)
        DO UPDATE SET
          department=EXCLUDED.department, auditor=EXCLUDED.auditor, auditor_type=EXCLUDED.auditor_type,
          scores=EXCLUDED.scores, section_notes=EXCLUDED.section_notes, q14=EXCLUDED.q14,
          special_note=EXCLUDED.special_note, signature=EXCLUDED.signature, overall_total=EXCLUDED.overall_total,
          updated_at=NOW(), created_by=EXCLUDED.created_by
        RETURNING id, site, audit_month, audit_type, overall_total, saved_at, updated_at
      `;
      return json(res,200,{audit:rows[0]});
    }

    if (req.method === 'DELETE') {
      const site = req.query?.site || '';
      const period = req.query?.period || req.query?.month || '';
      const type = String(req.query?.type || 'monthly').toLowerCase();
      if (!site || !period || !validType(type)) return json(res,400,{error:'site, type and period are required.'});
      if (!canAccessSite(user,site)) return json(res,403,{error:'You are not authorised to delete this site audit.'});
      await sql`DELETE FROM five_s_audits WHERE site=${site} AND audit_type=${type} AND audit_month=${period}`;
      return json(res,200,{ok:true});
    }
    return json(res,405,{error:'Method not allowed.'});
  } catch(e) { console.error(e); return json(res,500,{error:e.message||'Audit request failed.'}); }
}
