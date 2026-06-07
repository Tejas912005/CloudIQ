export async function fetchJson(path, options = {}) {
  const API_BASE = import.meta.env.VITE_BACKEND_URL || '';
  const url = path.startsWith('/api') ? `${API_BASE}${path}` : path;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-API-Key': import.meta.env.VITE_API_KEY,
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : { message: await response.text() };

  if (!response.ok) {
    throw new Error(
      payload?.error ||
      payload?.message ||
      `Request failed with status ${response.status}`
    );
  }

  return payload;
}

export function getErrorMessage(error, fallback = 'Something went wrong.') {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
