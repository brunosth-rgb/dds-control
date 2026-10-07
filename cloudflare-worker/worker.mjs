// DDS Control - proxy seguro para a API Hashdata.
// Cloudflare vars/secrets:
// HASHDATA_API_TOKEN -> secret
// FIREBASE_PROJECT_ID -> var, ex.: meu-projeto-firebase
// ALLOWED_ORIGINS -> var, ex.: https://brunosth-rgb.github.io,http://localhost:5173
//
// A autorização usa o mesmo documento ddsUsers/{uid} do Firestore.
// O ID token do Firebase é validado pelo próprio Firestore REST API + Security Rules.

const FORM_ID = '6abbeeab1990ff984e83a4ef';
const BASE = 'https://api2.hashdata.app/v1/export/forms';

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = allowedOrigins(env);
  const headers = {
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(request, env, body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders(request, env),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function tokenPayload(token) {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

async function authorizedFirebaseUser(request, env) {
  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : '';

  if (!token || token.length > 8192) return null;

  if (!env.FIREBASE_PROJECT_ID) {
    throw new Error('FIREBASE_PROJECT_ID não configurado no Worker.');
  }

  const payload = tokenPayload(token);
  const uid = String(payload?.user_id || payload?.sub || '');

  if (!/^[A-Za-z0-9:_-]{1,128}$/.test(uid)) {
    return null;
  }

  const project = encodeURIComponent(env.FIREBASE_PROJECT_ID);

  const path =
    `https://firestore.googleapis.com/v1/projects/${project}` +
    `/databases/(default)/documents/ddsUsers/${encodeURIComponent(uid)}`;

  const response = await fetch(path, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) return null;

  const document = await response.json();

  const active =
    document?.fields?.active?.booleanValue === true;

  if (!active) return null;

  return { uid };
}

function validOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  return allowedOrigins(env).includes(origin.replace(/\/$/, ''));
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      if (!validOrigin(request, env)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    const url = new URL(request.url);
    if (request.method !== 'GET') return json(request, env, { error: 'Método não permitido.' }, 405);
    if (!validOrigin(request, env)) return json(request, env, { error: 'Origem não autorizada.' }, 403);

    if (url.pathname === '/') {
      return json(request, env, { service: 'DDS Hashdata', status: 'Disponível' });
    }
    if (!['/forms', '/responses'].includes(url.pathname)) return json(request, env, { error: 'Não encontrado.' }, 404);

    try {
      const user = await authorizedFirebaseUser(request, env);
      if (!user) return json(request, env, { error: 'Acesso não autorizado.' }, 401);
    } catch (error) {
      return json(request, env, { error: error instanceof Error ? error.message : 'Falha na autenticação.' }, 503);
    }
    if (!env.HASHDATA_API_TOKEN) return json(request, env, { error: 'Token Hashdata não configurado.' }, 503);

    let upstream = BASE;
    if (url.pathname === '/responses') {
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      const valid = (value) => value && /^\d{4}-\d{2}-\d{2}T.*Z$/.test(value) && Number.isFinite(Date.parse(value));
      if (!valid(from) || !valid(to) || Date.parse(to) <= Date.parse(from) || Date.parse(to) - Date.parse(from) > 31 * 86400000) {
        return json(request, env, { error: 'Informe from e to em UTC, em um intervalo de até 31 dias.' }, 400);
      }
      const query = new URLSearchParams({ from, to, removeNewLineFromTexts: 'true' });
      upstream = `${BASE}/${FORM_ID}/responses?${query}`;
    }

    try {
      const response = await fetch(upstream, {
        headers: { 'HD-API-TOKEN': env.HASHDATA_API_TOKEN, Accept: 'application/json' },
        redirect: 'manual',
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok) return json(request, env, { error: 'Falha na API Hashdata.', upstreamStatus: response.status }, 502);
      const rows = await response.json();
      if (!Array.isArray(rows)) return json(request, env, { error: 'Formato inesperado na API Hashdata.' }, 502);
      if (url.pathname === '/forms') return json(request, env, { formId: FORM_ID, available: rows.some((x) => x?.form_id === FORM_ID) });
      return json(request, env, { formId: FORM_ID, records: rows, fetchedAt: new Date().toISOString() });
    } catch {
      return json(request, env, { error: 'Falha de conexão ou de leitura da resposta do Hashdata.' }, 502);
    }
  },
};
