const API_BASE = "/api/v1";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

const noRefreshPaths = ["/auth/login", "/auth/signup", "/auth/refresh"];

let signedOutHandler: (() => void) | null = null;
let refreshing: Promise<boolean> | null = null;

export function onSignedOut(handler: () => void): () => void {
  signedOutHandler = handler;
  return () => {
    if (signedOutHandler === handler) signedOutHandler = null;
  };
}

async function send(path: string, method: Method, body: unknown): Promise<Response> {
  const init: RequestInit = { method };
  if (method !== "GET") {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body ?? {});
  }
  try {
    return await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new ApiError(0, "NETWORK", "Can't reach the API.");
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  const data = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
  return new ApiError(res.status, data?.error ?? "UNKNOWN", data?.message ?? "Something went wrong.");
}

// Requests that fail together share one refresh, because a refresh token works only once.
function refreshSession(): Promise<boolean> {
  refreshing ??= send("/auth/refresh", "POST", {})
    .then(
      (res) => res.ok,
      () => false,
    )
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  if (!res.ok) throw await toApiError(res);
  return res.json() as Promise<T>;
}

export async function api<T>(path: string, options: { method?: Method; body?: unknown } = {}): Promise<T> {
  const method = options.method ?? "GET";
  const res = await send(path, method, options.body);
  if (res.status !== 401 || noRefreshPaths.includes(path)) return parse<T>(res);

  const retry = (await refreshSession()) ? await send(path, method, options.body) : res;
  if (retry.status !== 401) return parse<T>(retry);

  signedOutHandler?.();
  throw await toApiError(retry);
}
