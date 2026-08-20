import { db, json, readBody } from './_db.js';
import { requireUser, canAccessSite } from './_auth.js';

const DEFAULT_SITES = ['BBO','BKN','BTO','EME','GNT','HOF','HRN','LKM','MGT','MVB','ORIC','RDP','UDW','VBL','WMB'];

export default async function handler(req, res) {
  try {
    const sql = db();

    if (req.method === 'GET') {
      const rows = await sql`SELECT site FROM five_s_sites WHERE is_active=TRUE ORDER BY site`;
      if (!rows.length) {
        for (const site of DEFAULT_SITES) {
          await sql`INSERT INTO five_s_sites(site,is_active) VALUES(${site},TRUE) ON CONFLICT (site) DO NOTHING`;
        }
        return json(res, 200, { sites: DEFAULT_SITES });
      }
      return json(res, 200, { sites: rows.map(r => r.site) });
    }

    const user = await requireUser(req, res);
    if (!user) return;
    if (user.role !== 'external' && user.role !== 'admin') {
      return json(res, 403, { error: 'Only external auditors or administrators can add plants.' });
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const site = String(body.site || '').trim().toUpperCase().replace(/\s+/g, ' ');
      if (!site || site.length < 2 || site.length > 80) {
        return json(res, 400, { error: 'Enter a valid plant/site name.' });
      }
      const existing = await sql`SELECT site FROM five_s_sites WHERE lower(site)=lower(${site}) LIMIT 1`;
      if (existing.length) return json(res, 409, { error: 'That plant already exists.' });
      await sql`INSERT INTO five_s_sites(site,is_active) VALUES(${site},TRUE)`;
      if (user.role === 'external') {
        await sql`INSERT INTO five_s_user_sites(user_id,site) VALUES(${user.id},${site}) ON CONFLICT DO NOTHING`;
      }
      return json(res, 201, { site });
    }

    return json(res, 405, { error: 'Method not allowed.' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: e.message || 'Site request failed.' });
  }
}
