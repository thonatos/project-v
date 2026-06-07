export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
}

export function jsonError(status: number, code: string, message: string, details?: unknown): Response {
  const body: ApiError = { code, message };
  if (details !== undefined) body.details = details;
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function readJson<T = unknown>(request: Request): Promise<T> {
  const ct = request.headers.get('Content-Type') || '';
  if (!ct.includes('application/json')) {
    throw jsonError(415, 'unsupported_media_type', 'Content-Type 必须为 application/json');
  }
  try {
    return (await request.json()) as T;
  } catch (_e) {
    throw jsonError(400, 'invalid_json', '请求体不是合法 JSON');
  }
}

export function handleError(err: unknown): Response {
  if (err instanceof Response) return err;
  if (err instanceof Error) {
    return jsonError(500, 'internal_error', err.message);
  }
  return jsonError(500, 'internal_error', String(err));
}
