// Assurance Regent v4.7.0 Recovery Agent
// Supabase Edge Function -> OpenAI Responses API
// Store OPENAI_API_KEY in Supabase Edge Function Secrets. Never put it in browser JavaScript.
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function publishableKey() {
  const raw = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '';
  if (raw) {
    try {
      const keys = JSON.parse(raw);
      if (keys.default) return String(keys.default);
      const first = Object.values(keys)[0];
      if (first) return String(first);
    } catch (_) {}
  }
  return Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
}

async function rpc(name, payload) {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = publishableKey();
  if (!url || !key) throw new Error('Supabase project environment is unavailable to the Recovery Agent.');
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload || {}),
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }
  if (!response.ok) {
    const message = body?.message || body?.error || body?.hint || `Supabase RPC ${name} failed (${response.status}).`;
    throw new Error(message);
  }
  return body;
}

function compactRecord(value, depth = 0) {
  if (value == null) return value;
  if (depth > 5) return '[nested data omitted]';
  if (Array.isArray(value)) return value.slice(0, 120).map((x) => compactRecord(x, depth + 1));
  if (typeof value !== 'object') {
    if (typeof value === 'string' && value.length > 2500) return `${value.slice(0, 2500)}…`;
    return value;
  }
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    const k = key.toLowerCase();
    if (['data','document_data','profilephoto','profile_photo','passwordhash','password_hash','token','token_hash'].includes(k)) continue;
    out[key] = compactRecord(val, depth + 1);
  }
  return out;
}

function companyMatch(row, companyId) {
  if (!row || typeof row !== 'object') return false;
  const id = String(row.companyId ?? row.company_id ?? '').trim();
  return Boolean(companyId) && id === companyId;
}

function scopedContext(actor, state) {
  const role = String(actor?.role || 'Employee');
  const companyId = String(actor?.companyId || '').trim();
  const developer = role === 'Developer';
  const live = state?.live || {};
  const mts = state?.mts || {};
  const control = state?.control || {};
  const auth = state?.auth || {};
  const scope = (rows) => {
    const list = Array.isArray(rows) ? rows : [];
    return (developer ? list : list.filter((row) => companyMatch(row, companyId))).slice(0, 120).map((x) => compactRecord(x));
  };

  const scopedLive = {};
  for (const key of ['employees','projects','payroll','calendar','timeEntries','sources','sourceChecks','vacancies','candidates','onboarding']) {
    scopedLive[key] = scope(live[key]);
  }

  const companies = developer
    ? (Array.isArray(auth.companies) ? auth.companies : [])
    : (Array.isArray(auth.companies) ? auth.companies.filter((x) => String(x.id || '') === companyId) : []);
  const accounts = developer
    ? (Array.isArray(auth.accounts) ? auth.accounts : [])
    : (Array.isArray(auth.accounts) ? auth.accounts.filter((x) => String(x.companyId || '') === companyId) : []);

  return compactRecord({
    actor: {
      id: actor?.id || '', name: actor?.name || actor?.id || '', role,
      position: actor?.position || '', companyId,
    },
    companies,
    accounts: accounts.map((x) => ({ id:x.id, name:x.name, position:x.position, role:x.role, companyId:x.companyId, active:x.active })),
    settings: control.settings || {},
    documents: scope(control.documents),
    reviews: scope(control.reviews),
    live: scopedLive,
    workActivity: {
      sessions: scope(mts.sessions),
      messages: scope(mts.messages),
    },
  });
}

function outputText(response) {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) return response.output_text.trim();
  const parts = [];
  for (const item of (response?.output || [])) {
    for (const content of (item?.content || [])) {
      if ((content?.type === 'output_text' || content?.type === 'text') && typeof content?.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Use POST for the Recovery Agent.' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const sessionToken = String(body?.session_token || '').trim();
    const mode = String(body?.mode || 'chat').trim().toLowerCase();
    const apiKey = Deno.env.get('OPENAI_API_KEY') || '';
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-5.1';

    if (!sessionToken) return json({ error: 'Sign in to Assurance Regent before using Recovery Agent.' }, 401);

    // This RPC validates the custom Assurance Regent session token server-side.
    const contextEnvelope = await rpc('assurance_regent_browser_agent_context', { p_token: sessionToken });
    const actor = contextEnvelope?.actor || null;
    if (!actor?.id) return json({ error: 'The signed-in Assurance Regent user could not be verified.' }, 401);

    if (mode === 'status') {
      return json({ ok: true, configured: Boolean(apiKey), model, user: { id:actor.id, role:actor.role } });
    }

    const message = String(body?.message || '').trim();
    if (!message) return json({ error: 'Message is required.' }, 400);
    if (message.length > 12000) return json({ error: 'Please shorten the Recovery Agent message to 12,000 characters or fewer.' }, 400);
    if (!apiKey) return json({ error: 'Recovery Agent is installed, but OPENAI_API_KEY has not been added to Supabase Edge Function Secrets.' }, 503);

    const thread = await rpc('assurance_regent_browser_agent_thread', { p_token: sessionToken, p_limit: 24 });
    const history = (Array.isArray(thread) ? thread : []).slice(-16).map((m) => `${m.role === 'user' ? 'User' : 'Recovery Agent'}: ${String(m.content || '').slice(0, 3000)}`).join('\n');
    const context = scopedContext(actor, contextEnvelope?.state || {});

    const instructions = `You are Recovery Agent inside Assurance Regent, an HR, work-evidence and cost-recovery application. You are software, not a human employee. Be accurate, concise, practical and professional. Ground answers in the supplied Assurance Regent context when the question is about the organisation, employees, projects, payroll, recovery evidence, work activity, recruiting, onboarding, documents or reviews. Never invent a person, project, amount, approval, status, document or completed action. Distinguish stored facts from your inference. If information is missing, say what is missing. Do not claim to have edited, approved, deleted, created or posted records: this v4.7.0 Recovery Agent is advisory/read-only. Explain the exact manual next step when the user asks for a data-changing action. Treat payroll, recovery, legal and HR decisions as decision support, not final authority. Do not reveal secrets, credentials, hidden tokens or raw document payloads.`;

    const input = `SIGNED-IN USER\n${JSON.stringify({id:actor.id,name:actor.name,role:actor.role,position:actor.position,companyId:actor.companyId}, null, 2)}\n\nCURRENT ASSURANCE REGENT CONTEXT\n${JSON.stringify(context, null, 2)}\n\nRECENT RECOVERY AGENT CONVERSATION\n${history || '(no prior conversation)'}\n\nCURRENT USER MESSAGE\n${message}`;

    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        instructions,
        input,
        store: false,
        max_output_tokens: 1400,
      }),
    });

    const openaiText = await openaiResponse.text();
    let openai = null;
    try { openai = openaiText ? JSON.parse(openaiText) : null; } catch (_) { openai = { error: { message: openaiText } }; }

    if (!openaiResponse.ok) {
      const detail = openai?.error?.message || `OpenAI request failed (${openaiResponse.status}).`;
      if (openaiResponse.status === 401) return json({ error: 'OpenAI rejected the configured API key. Create a fresh project API key and replace OPENAI_API_KEY in Supabase Edge Function Secrets.' }, 502);
      if (openaiResponse.status === 429) return json({ error: 'OpenAI rate or quota limit reached. Check the API project billing/limits, then try again.' }, 429);
      return json({ error: detail }, 502);
    }

    const answer = outputText(openai);
    if (!answer) return json({ error: 'OpenAI returned no text response.' }, 502);

    await rpc('assurance_regent_browser_agent_append', {
      p_token: sessionToken,
      p_role: 'user',
      p_content: message,
      p_source: 'conversation',
      p_metadata: { model, request_id: openai?.id || '' },
    });
    await rpc('assurance_regent_browser_agent_append', {
      p_token: sessionToken,
      p_role: 'assistant',
      p_content: answer,
      p_source: 'conversation',
      p_metadata: { model, response_id: openai?.id || '' },
    });

    return json({
      ok: true,
      output_text: answer,
      model,
      llm_configured: true,
      requires_approval: false,
      executed_actions: [],
      advisory_only: true,
    });
  } catch (error) {
    console.error('Recovery Agent error:', error);
    const message = error instanceof Error ? error.message : String(error || 'Recovery Agent failed.');
    const status = /session has expired|signed-in/i.test(message) ? 401 : 500;
    return json({ error: message }, status);
  }
});
