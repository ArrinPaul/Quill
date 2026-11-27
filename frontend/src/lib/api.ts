/** Resolve the backend base URL. Empty string means same-origin `/api` (used on Vercel). */
export function resolveApiBaseUrl(
  envUrl: string | undefined = process.env.NEXT_PUBLIC_BACKEND_URL
): string {
  return envUrl ?? "http://localhost:4000";
}

export const API_BASE = resolveApiBaseUrl();

interface RequestOptions extends RequestInit {
  token?: string;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else if (typeof window !== "undefined") {
    const storedToken = localStorage.getItem("Quill_token");
    if (storedToken) {
      headers["Authorization"] = `Bearer ${storedToken}`;
    }
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      cache: "no-store",
      ...fetchOptions,
      headers,
    });
  } catch {
    throw new Error("Network error  please check your connection and try again.");
  }

  if (!res.ok) {
    if (res.status === 401 && headers["Authorization"] && typeof window !== "undefined") {
      localStorage.removeItem("Quill_token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    const fallback =
      res.status === 429
        ? "Too many attempts. Please try again later."
        : "Something went wrong";
    const error = await res.json().catch(() => ({ message: fallback }));
    throw new Error(error.message || (res.status === 429 ? fallback : `Request failed with status ${res.status}`));
  }

  return res.json();
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "POST", body: body ? JSON.stringify(body) : undefined }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "PUT", body: body ? JSON.stringify(body) : undefined }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "PATCH", body: body ? JSON.stringify(body) : undefined }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "DELETE" }),
};
