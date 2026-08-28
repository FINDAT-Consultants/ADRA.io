import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const publicDir = resolve(root, 'public');
const indexPath = resolve(publicDir, 'index.html');
const bridgePath = resolve(publicDir, 'supabase-live-dashboard-v6-3-129.js');
const RUNTIME_TYPE = 'application/x-assurance-regent-runtime';

if (!existsSync(indexPath)) throw new Error('Published public/index.html is missing.');

const bridge = `(() => {
  'use strict';

  const VERSION = '6.3.129';
  const SUPABASE_URL = 'https://fubqwljypdiojpbdunjc.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_bCscsMezuyabUbEA3gaXfw_awPFhqRq';
  const SESSION_TOKEN_KEY = 'assurance-regent-supabase-session-v460';
  const html = document.documentElement;
  let refreshPromise = null;
  let lastRefreshAt = 0;

  const sessionToken = () => {
    try { return sessionStorage.getItem(SESSION_TOKEN_KEY) || ''; }
    catch (_) { return ''; }
  };

  const asArray = (value) => Array.isArray(value) ? value : [];
  const text = (value, fallback = '') => {
    const clean = String(value ?? '').trim();
    return clean || fallback;
  };
  const lower = (value) => text(value).toLowerCase();
  const companyOf = (row) => text(row?.companyId || row?.company_id || row?.companyID || '');
  const employeeIdOf = (row) => text(row?.employeeId || row?.employee_id || row?.userId || row?.user_id || row?.id || '');
  const dateValue = (row) => row?.updated_at || row?.updatedAt || row?.clock_out_at || row?.clockOutAt || row?.created_at || row?.createdAt || row?.work_date || row?.workDate || '';

  const rpc = async (name, payload = {}, timeoutMs = 10000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent(name), {
        method: 'POST',
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
        signal: controller.signal,
      });
      const raw = await response.text();
      let body = null;
      try { body = raw ? JSON.parse(raw) : null; } catch (_) { body = raw; }
      if (!response.ok) {
        const message = body?.message || body?.error || body?.hint || ('Supabase request failed (' + response.status + ').');
        throw new Error(String(message));
      }
      return body;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Supabase live data timed out.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };

  const scopeRows = (rows, status) => {
    const values = asArray(rows);
    if (lower(status?.role) === 'developer') return values;
    const companyId = text(status?.companyId || status?.company_id || '');
    if (!companyId) return [];
    return values.filter((row) => companyOf(row) === companyId);
  };

  const initials = (name) => {
    const parts = text(name, 'User').split(/\\s+/u).filter(Boolean);
    return parts.slice(0, 2).map((part) => part.slice(0, 1).toUpperCase()).join('') || 'U';
  };

  const formatDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    try {
      return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
    } catch (_) {
      return date.toLocaleString();
    }
  };

  const replaceChildren = (element, children) => {
    if (!element) return;
    element.replaceChildren(...children);
    element.dataset.supabaseSource = 'live';
  };

  const metricCard = (label, value, detail, tone = '') => {
    const article = document.createElement('article');
    article.className = 'people-summary-metric' + (tone ? ' ' + tone : '');
    const small = document.createElement('small');
    const strong = document.createElement('b');
    const span = document.createElement('span');
    small.textContent = label;
    strong.textContent = String(value);
    span.textContent = detail;
    article.append(small, strong, span);
    return article;
  };

  const identity = (name, subtitle) => {
    const wrapper = document.createElement('span');
    wrapper.className = 'user-identity';
    const avatar = document.createElement('span');
    avatar.className = 'user-avatar sm';
    avatar.textContent = initials(name);
    const copy = document.createElement('span');
    copy.className = 'user-identity-text';
    const strong = document.createElement('b');
    const small = document.createElement('small');
    strong.textContent = text(name, 'Employee');
    small.textContent = text(subtitle, 'Supabase live record');
    copy.append(strong, small);
    wrapper.append(avatar, copy);
    return wrapper;
  };

  const emptyPeople = (message) => {
    const empty = document.createElement('div');
    empty.className = 'people-list-empty';
    empty.textContent = message;
    return empty;
  };

  const sessionRow = (session, fallbackEmployee = null) => {
    const article = document.createElement('article');
    const employeeName = text(session?.employee_name || session?.employeeName || fallbackEmployee?.name, 'Employee');
    const employeeId = employeeIdOf(session) || employeeIdOf(fallbackEmployee);
    const activity = text(session?.activity_description || session?.activityDescription || session?.project_code || session?.projectCode, 'Work activity');
    const subtitle = employeeId ? employeeId + ' · ' + activity : activity;
    const meta = document.createElement('small');
    const state = text(session?.job_status || session?.jobStatus || session?.status, 'live');
    const when = formatDate(dateValue(session));
    meta.textContent = when ? state + ' · ' + when : state;
    article.append(identity(employeeName, subtitle), meta);
    return article;
  };

  const employeeRow = (employee) => {
    const article = document.createElement('article');
    const name = text(employee?.name || employee?.employeeName, 'Employee');
    const role = [text(employee?.position), text(employee?.department)].filter(Boolean).join(' · ');
    const meta = document.createElement('small');
    const status = text(employee?.employmentStatus || (employee?.active === false ? 'inactive' : 'active'), 'active');
    const when = formatDate(dateValue(employee));
    meta.textContent = when ? status + ' · ' + when : status;
    article.append(identity(name, role || employeeIdOf(employee)), meta);
    return article;
  };

  const renderPeopleList = (id, rows, makeRow, emptyMessage, limit = 5) => {
    const container = document.getElementById(id);
    if (!container) return;
    const items = asArray(rows).slice(0, limit).map(makeRow);
    replaceChildren(container, items.length ? items : [emptyPeople(emptyMessage)]);
  };

  const renderDashboard = (state, status) => {
    const live = state?.live && typeof state.live === 'object' ? state.live : {};
    const mts = state?.mts && typeof state.mts === 'object' ? state.mts : {};
    const employees = scopeRows(live.employees, status);
    const projects = scopeRows(live.projects, status);
    const payroll = scopeRows(live.payroll, status);
    const timeEntries = scopeRows(live.timeEntries || live.time_entries, status);
    const sessions = scopeRows(mts.sessions, status);

    const activeEmployees = employees.filter((employee) => employee?.active !== false && !['inactive','terminated','separated'].includes(lower(employee?.employmentStatus)));
    const activeSessions = sessions
      .filter((session) => !session?.clock_out_at && !session?.clockOutAt && !['completed','closed','cancelled'].includes(lower(session?.status)))
      .sort((a, b) => String(dateValue(b)).localeCompare(String(dateValue(a))));
    const recentSessions = sessions
      .filter((session) => Boolean(session?.clock_out_at || session?.clockOutAt) || ['completed','closed'].includes(lower(session?.status)))
      .sort((a, b) => String(dateValue(b)).localeCompare(String(dateValue(a))));
    const attentionSessions = sessions
      .filter((session) => ['pending','blocked','review','delayed','overdue','failed'].includes(lower(session?.job_status || session?.jobStatus)) || ['blocked','failed','delayed'].includes(lower(session?.status)))
      .sort((a, b) => String(dateValue(b)).localeCompare(String(dateValue(a))));
    const attentionEmployees = employees.filter((employee) => employee?.active === false || ['inactive','terminated','separated'].includes(lower(employee?.employmentStatus)) || !text(employee?.position));

    const employeeCount = document.getElementById('dashEmployeeCount');
    if (employeeCount) {
      employeeCount.textContent = String(employees.length);
      employeeCount.dataset.supabaseSource = 'live';
      employeeCount.title = 'Authenticated Supabase company directory';
    }

    const primaryNote = document.querySelector('.people-summary-primary > span');
    if (primaryNote) {
      const updated = formatDate(state?.updatedAt || state?.updated_at);
      primaryNote.textContent = updated ? 'Supabase live · synced ' + updated : 'Supabase live company directory';
      primaryNote.dataset.supabaseSource = 'live';
    }

    const kpis = document.getElementById('dashboardKpis');
    if (kpis) {
      replaceChildren(kpis, [
        metricCard('Active employees', activeEmployees.length, 'Company-scoped Supabase directory', 'good'),
        metricCard('Projects', projects.length, 'Live project records'),
        metricCard('Payroll records', payroll.length, 'Live payroll rows'),
        metricCard('Time entries', timeEntries.length, 'Live recovery entries'),
      ]);
    }

    renderPeopleList('dashActivePeople', activeSessions, (session) => sessionRow(session), 'No active Supabase work sessions.', 5);

    if (recentSessions.length) {
      renderPeopleList('dashRecentPeople', recentSessions, (session) => sessionRow(session), 'No recent Supabase completions.', 5);
    } else {
      const recentEmployees = [...employees].sort((a, b) => String(dateValue(b)).localeCompare(String(dateValue(a))));
      renderPeopleList('dashRecentPeople', recentEmployees, (employee) => employeeRow(employee), 'No recent Supabase people records.', 5);
    }

    if (attentionSessions.length) {
      renderPeopleList('dashAttentionPeople', attentionSessions, (session) => sessionRow(session), 'No Supabase attention items.', 5);
    } else {
      renderPeopleList('dashAttentionPeople', attentionEmployees, (employee) => employeeRow(employee), 'No Supabase attention items.', 5);
    }

    html.dataset.supabaseLive = 'ready';
    html.dataset.supabaseLiveVersion = VERSION;
    html.dataset.supabaseLiveCompany = text(status?.companyId || status?.company_id, lower(status?.role) === 'developer' ? 'all' : '');
    html.dataset.supabaseLiveEmployees = String(employees.length);
    html.dataset.supabaseLiveProjects = String(projects.length);
    html.dataset.supabaseLiveSessions = String(sessions.length);
    html.dataset.supabaseLiveUpdatedAt = text(state?.updatedAt || state?.updated_at || new Date().toISOString());

    window.dispatchEvent(new CustomEvent('assurance-regent-supabase-live', {
      detail: {
        version: VERSION,
        employees: employees.length,
        projects: projects.length,
        payroll: payroll.length,
        timeEntries: timeEntries.length,
        sessions: sessions.length,
      },
    }));
  };

  const refresh = async ({ force = false } = {}) => {
    const now = Date.now();
    if (!force && now - lastRefreshAt < 15000) return;
    if (refreshPromise) return refreshPromise;
    const token = sessionToken();
    if (!token) {
      html.dataset.supabaseLive = 'signed-out';
      return;
    }

    refreshPromise = (async () => {
      html.dataset.supabaseLive = 'loading';
      const status = await rpc('assurance_regent_browser_session_status', { p_token: token }, 7000);
      if (!status?.ok && !status?.userId && !status?.user_id) throw new Error('The browser session is not valid.');
      const statePayload = await rpc('assurance_regent_browser_read_state', { p_token: token }, 10000);
      const state = statePayload?.state && typeof statePayload.state === 'object' ? statePayload.state : statePayload;
      if (!state || typeof state !== 'object') throw new Error('Supabase returned no browser state.');
      renderDashboard(state, status || {});
      lastRefreshAt = Date.now();
      return state;
    })().catch((error) => {
      html.dataset.supabaseLive = 'error';
      html.dataset.supabaseLiveError = text(error?.message, 'Supabase live data unavailable').slice(0, 180);
      console.error('[supabase-live-dashboard] refresh failed', error);
      return null;
    }).finally(() => {
      refreshPromise = null;
    });

    return refreshPromise;
  };

  window.AssuranceRegentSupabaseLive = Object.freeze({
    version: VERSION,
    refresh: () => refresh({ force: true }),
  });

  setTimeout(() => refresh({ force: true }), 900);
  setTimeout(() => refresh({ force: true }), 3500);
  window.addEventListener('focus', () => refresh({ force: false }));
  window.addEventListener('assurance-regent-session-ready', () => refresh({ force: true }));
})();
`;

writeFileSync(bridgePath, bridge, 'utf8');

const digest = (source) => ({
  version: createHash('sha256').update(source).digest('hex').slice(0, 16),
  integrity: `sha384-${createHash('sha384').update(source).digest('base64')}`,
});
const bridgeDigest = digest(bridge);
const bridgeTag = `  <script type="${RUNTIME_TYPE}" src="./supabase-live-dashboard-v6-3-129.js?v=${bridgeDigest.version}" integrity="${bridgeDigest.integrity}" crossorigin="anonymous"></script>`;

let html = readFileSync(indexPath, 'utf8');
html = html.replace(/\s*<script\b[^>]*\bsrc=["']\.\/supabase-live-dashboard-v6-3-\d+\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/giu, '\n');

const appTag = /<script\b[^>]*\btype=["']application\/x-assurance-regent-runtime["'][^>]*\bsrc=["']\.\/app(?:\.[^"'?]+)?\.js(?:\?[^"']*)?["'][^>]*><\/script>/iu;
if (!appTag.test(html)) throw new Error('Published application runtime manifest is missing; cannot place Supabase live bridge.');
html = html.replace(appTag, (match) => `${match}\n${bridgeTag}`);

writeFileSync(indexPath, html, 'utf8');
console.log(`[supabase-live-dashboard] published v6.3.129 js=${bridgeDigest.version}; authenticated bridge placed immediately after app runtime.`);
