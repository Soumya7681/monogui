/**
 * Browser-side fetch helper. Parses the standard `{ status, message }`
 * envelope and throws an Error carrying the server message on non-2xx.
 */
export async function apiFetch<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }
  if (!res.ok) {
    const message =
      (data as { message?: string }).message ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}
