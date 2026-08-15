declare const Deno: any;

const BUCKET = 'assurance-regent-files';
const MAX_BYTES = 50 * 1024 * 1024;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: any, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS, 'content-type': 'application/json', 'cache-control': 'no-store' },
});
const env = (name: string) => String(Deno.env.get(name) || '').trim();
const base = () => env('SUPABASE_URL').replace(/\/$/, '');
const serviceKey = () => env('SUPABASE_SERVICE_ROLE_KEY');
const headers = (extra: Record<string,string> = {}) => ({
  apikey: serviceKey(),
  Authorization: `Bearer ${serviceKey()}`,
  ...extra,
});
async function sf(path: string, init: any = {}) {
  const r = await fetch(base() + path, { ...init, headers: { ...headers(), ...(init.headers || {}) } });
  const text = await r.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!r.ok) throw new Error(body?.message || body?.error || String(body || `HTTP ${r.status}`));
  return body;
}
const rpc = (name: string, payload: any = {}) => sf(`/rest/v1/rpc/${encodeURIComponent(name)}`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
});
const clean = (v: any, n = 300) => String(v ?? '').trim().replace(/[\u0000-\u001f]/g, ' ').slice(0, n);
const filename = (v: any) => {
  const s = clean(v, 220).replace(/[\\/]+/g, '_').replace(/[^\p{L}\p{N}._ ()\[\]-]/gu, '_').replace(/\s+/g, ' ').trim();
  return s || 'file';
};
const segment = (v: any) => clean(v, 120).replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_') || 'general';
const q = (v: any) => encodeURIComponent(String(v ?? ''));
function actorCompany(actor: any, requested = '') {
  const role = clean(actor?.role, 60);
  const own = clean(actor?.companyId, 160);
  if (role === 'Developer') return clean(requested, 160) || own || 'GLOBAL';
  if (!own) throw new Error('This account is not connected to a company.');
  if (requested && clean(requested,160) !== own) throw new Error('The requested file company is outside your permitted scope.');
  return own;
}
async function actor(token: string) {
  if (!token) throw new Error('Assurance Regent session is required.');
  return await rpc('assurance_regent_browser_actor_from_token', { p_token: token });
}
async function rowById(id: string) {
  const rows = await sf(`/rest/v1/assurance_regent_files?id=eq.${q(id)}&select=*&limit=1`, { headers: { accept: 'application/json' } });
  return rows?.[0] || null;
}
function ensureRead(actorRow: any, fileRow: any) {
  if (!fileRow) throw new Error('File record not found.');
  if (clean(actorRow?.role,60) === 'Developer') return;
  if (clean(fileRow.company_id,160) !== clean(actorRow?.companyId,160)) throw new Error('This file is outside your permitted company scope.');
}
function signedUrlFromStoragePath(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${base()}/storage/v1${path.startsWith('/') ? path : '/' + path}`;
}

Deno.serve(async (req: any) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST is required.' }, 405);
  try {
    const z = await req.json().catch(() => ({}));
    const mode = clean(z.mode || z.action, 50).toLowerCase();
    const token = clean(z.session_token, 260);
    const who = await actor(token);

    if (mode === 'status') return json({ ok: true, bucket: BUCKET, max_bytes: MAX_BYTES, actor_id: who?.id || '' });

    if (mode === 'prepare_upload') {
      const original = filename(z.file_name || z.name);
      const size = Number(z.size_bytes ?? z.size ?? 0);
      if (!Number.isFinite(size) || size < 0 || size > MAX_BYTES) throw new Error('Internal files must be 50 MB or smaller.');
      const mime = clean(z.mime_type || z.type || 'application/octet-stream', 220) || 'application/octet-stream';
      const category = segment(z.category || 'general');
      const company = actorCompany(who, clean(z.company_id,160));
      const id = crypto.randomUUID();
      const path = `${segment(company)}/${segment(who?.id || 'user')}/${category}/${new Date().toISOString().slice(0,10)}/${id}/${filename(original)}`;
      const metadata = (z.metadata && typeof z.metadata === 'object' && !Array.isArray(z.metadata)) ? z.metadata : {};
      const insert = {
        id,
        company_id: company,
        actor_id: clean(who?.id,160),
        category: clean(z.category || 'general',100),
        entity_type: clean(z.entity_type,100),
        entity_id: clean(z.entity_id,200),
        original_name: original,
        mime_type: mime,
        size_bytes: Math.floor(size),
        bucket_id: BUCKET,
        storage_path: path,
        status: 'PENDING',
        metadata,
      };
      await sf('/rest/v1/assurance_regent_files', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(insert),
      });
      try {
        const signed = await sf(`/storage/v1/object/upload/sign/${BUCKET}/${path.split('/').map(q).join('/')}`, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
        });
        const raw = String(signed?.url || signed?.signedURL || signed?.signedUrl || '');
        if (!raw) throw new Error('Storage did not issue an upload URL.');
        return json({ ok: true, file_id: id, bucket: BUCKET, path, signed_url: signedUrlFromStoragePath(raw), max_bytes: MAX_BYTES });
      } catch (e) {
        await sf(`/rest/v1/assurance_regent_files?id=eq.${q(id)}`, {
          method: 'PATCH', headers: { 'content-type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'FAILED', updated_at: new Date().toISOString(), metadata: { ...metadata, prepare_error: String((e as any)?.message || e).slice(0,500) } }),
        }).catch(() => {});
        throw e;
      }
    }

    if (mode === 'commit_upload') {
      const id = clean(z.file_id, 80);
      const row = await rowById(id); ensureRead(who,row);
      await sf(`/rest/v1/assurance_regent_files?id=eq.${q(id)}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ status: 'STORED', stored_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      });
      return json({ ok: true, file_id: id, path: row.storage_path, name: row.original_name, mime_type: row.mime_type, size_bytes: row.size_bytes });
    }

    if (mode === 'signed_download') {
      const id = clean(z.file_id, 80);
      const row = await rowById(id); ensureRead(who,row);
      if (row.status !== 'STORED') throw new Error('This file has not completed storage.');
      const signed = await sf(`/storage/v1/object/sign/${BUCKET}/${String(row.storage_path).split('/').map(q).join('/')}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expiresIn: 600 }),
      });
      const raw = String(signed?.signedURL || signed?.signedUrl || '');
      if (!raw) throw new Error('Storage did not issue a download URL.');
      return json({ ok: true, file_id: id, url: signedUrlFromStoragePath(raw), expires_in: 600, name: row.original_name, mime_type: row.mime_type, size_bytes: row.size_bytes });
    }

    if (mode === 'list') {
      const company = actorCompany(who, clean(z.company_id,160));
      const limit = Math.max(1, Math.min(100, Math.floor(Number(z.limit || 50))));
      let query = `company_id=eq.${q(company)}&status=eq.STORED&select=id,company_id,actor_id,category,entity_type,entity_id,original_name,mime_type,size_bytes,status,created_at,stored_at&order=created_at.desc&limit=${limit}`;
      if (z.entity_type) query += `&entity_type=eq.${q(clean(z.entity_type,100))}`;
      if (z.entity_id) query += `&entity_id=eq.${q(clean(z.entity_id,200))}`;
      const rows = await sf('/rest/v1/assurance_regent_files?' + query, { headers: { accept: 'application/json' } });
      return json({ ok: true, files: rows || [] });
    }

    return json({ error: 'Unknown file-storage action.' }, 400);
  } catch (e: any) {
    return json({ error: String(e?.message || e || 'File-storage request failed.') }, 400);
  }
});
