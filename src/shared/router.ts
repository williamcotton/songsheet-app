import { match } from 'path-to-regexp';
import type { RouteHandler } from './types/index.ts';

interface Route {
  method: string;
  path: string;
  handler: RouteHandler;
  matcher: ReturnType<typeof match>;
}

export class Router {
  private routes: Route[] = [];

  add(method: string, path: string, handler: RouteHandler) {
    this.routes.push({
      method,
      path,
      handler,
      matcher: match(path, { decode: decodeURIComponent }),
    });
  }

  match(method: string, pathname: string): { handler: RouteHandler; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method !== method.toLowerCase()) continue;
      const result = route.matcher(pathname);
      if (result) {
        const params: Record<string, string> = {};
        for (const [key, value] of Object.entries(result.params)) {
          if (typeof value === 'string') {
            params[key] = value;
          }
        }
        return { handler: route.handler, params };
      }
    }
    return null;
  }
}
