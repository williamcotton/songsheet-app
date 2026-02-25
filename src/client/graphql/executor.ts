import type { GraphQLExecutor, GraphQLResult } from '../../shared/types/index.ts';

declare global {
  interface Window {
    __INITIAL_DATA__?: {
      graphql: Record<string, GraphQLResult>;
    };
  }
}

export function createClientExecutor(): GraphQLExecutor {
  // SSR cache: use data injected by server, then clear after first use per key
  const ssrCache = window.__INITIAL_DATA__?.graphql ?? {};

  return async (query, variables) => {
    const key = JSON.stringify({ query: query.trim(), variables });

    // Check SSR cache first
    if (ssrCache[key]) {
      const result = ssrCache[key];
      delete ssrCache[key];
      return result;
    }

    // Fetch from server
    const response = await fetch('/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });

    return response.json();
  };
}
