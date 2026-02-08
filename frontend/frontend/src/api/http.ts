// frontend/src/api/http.ts
export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

type QueryValue = string | number | boolean | null | undefined;

export type RequestOptions = {
  headers?: HeadersInit;
  signal?: AbortSignal;
  query?: Record<string, QueryValue>;
};

const BASE = "/api";

function withBase(path: string) {
  // allow: "/schedule/classes" OR "schedule/classes" OR "/api/schedule/classes"
  let p = path.trim();
  if (!p.startsWith("/")) p = "/" + p;
  if (p.startsWith(BASE + "/") || p === BASE) return p;
  return BASE + p;
}

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const url = new URL(withBase(path), window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function parseBody(res: Response) {
  const ct = res.headers.get("content-type") ?? "";
  const isJson = ct.includes("application/json");
  if (res.status === 204) return null;

  if (isJson) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  // fallback text
  try {
    return await res.text();
  } catch {
    return null;
  }
}

function extractErrorMessage(body: unknown, fallback: string) {
  // FastAPI często zwraca { detail: "..." } albo { detail: {...} }
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as any).detail;
    if (typeof detail === "string") return detail;
    return fallback;
  }
  if (typeof body === "string" && body.trim()) return body;
  return fallback;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: RequestOptions
): Promise<T> {
  const url = buildUrl(path, options?.query);

  const headers: HeadersInit = {
    Accept: "application/json",
    ...(options?.headers ?? {}),
  };

  const init: RequestInit = {
    method,
    headers,
    signal: options?.signal,
    // przy proxy (vite) i przyszłych cookies tokenach nie przeszkadza:
    credentials: "include",
  };

  if (body !== undefined) {
    (headers as any)["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  const parsed = await parseBody(res);

  if (!res.ok) {
    const msg = extractErrorMessage(
      parsed,
      `HTTP ${res.status} ${res.statusText}`
    );
    throw new ApiError(res.status, msg, parsed);
  }

  return parsed as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>("GET", path, undefined, options),

  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, body, options),

  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, body, options),

  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, body, options),

  del: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("DELETE", path, body, options),
};
