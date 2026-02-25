export function parseQueryString(search: string): Record<string, string> {
  const params: Record<string, string> = {};
  const searchStr = search.startsWith('?') ? search.slice(1) : search;
  if (!searchStr) return params;

  const queryParams = new URLSearchParams(searchStr);
  for (const [key, value] of queryParams.entries()) {
    params[key] = value;
  }

  return params;
}

export function parseFormBody(body: string): Record<string, string> {
  return parseQueryString(body);
}
