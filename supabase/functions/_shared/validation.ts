export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-nodeop-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

export function jsonResponse(payload: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}

export function isValidThorAddress(address: string): boolean {
  if (!address) return false;
  const normalized = address.trim().toLowerCase();
  return normalized.startsWith('thor') && normalized.length === 43;
}

export function parseIntegerParam(
  value: string | null,
  fallback: number,
  options: { min?: number; max?: number } = {}
): number {
  if (value == null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const integer = Math.trunc(parsed);
  const min = Number.isFinite(options.min) ? Number(options.min) : integer;
  const max = Number.isFinite(options.max) ? Number(options.max) : integer;

  return Math.min(max, Math.max(min, integer));
}

export function requireMethod(request: Request, method: string): string | null {
  if (request.method === 'OPTIONS') {
    return null;
  }

  if (request.method !== method) {
    return `Method ${request.method} not allowed`;
  }

  return null;
}

export function parseAuthToken(request: Request): string {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return '';
  }

  return authHeader.slice(7).trim();
}
