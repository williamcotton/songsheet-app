import { renderToString } from 'react-dom/server';
import type { ReactElement } from 'react';
import { Router } from './shared/router.ts';
import { registerRoutes } from './shared/universal-app.tsx';
import type { UniversalRequest, UniversalResponse, GraphQLExecutor, GraphQLResult } from './shared/types/index.ts';
import { parseQueryString } from './shared/utils/index.ts';

interface RenderResult {
  appHtml: string;
  graphqlCache: Record<string, GraphQLResult>;
  statusCode: number;
  redirect?: string;
}

export async function render(
  url: string,
  method: string,
  body: any,
  graphqlExecutor: GraphQLExecutor
): Promise<RenderResult> {
  const router = new Router();
  const app = {
    get(path: string, handler: any) { router.add('get', path, handler); },
    post(path: string, handler: any) { router.add('post', path, handler); },
  };
  registerRoutes(app);

  const [pathname, search] = url.split('?');
  const matched = router.match(method.toLowerCase(), pathname ?? url);

  if (!matched) {
    return { appHtml: '', graphqlCache: {}, statusCode: 404 };
  }

  const graphqlCache: Record<string, GraphQLResult> = {};

  // Build a caching wrapper around the executor
  const cachingExecutor: GraphQLExecutor = async (query, variables) => {
    const key = JSON.stringify({ query: query.trim(), variables });
    const result = await graphqlExecutor(query, variables);
    graphqlCache[key] = result;
    return result;
  };

  let appHtml = '';
  let statusCode = 200;
  let redirect: string | undefined;

  const req: UniversalRequest = {
    path: pathname ?? url,
    method,
    params: matched.params,
    query: parseQueryString(search ?? ''),
    body,
    graphql: cachingExecutor,
  };

  const res: UniversalResponse = {
    renderApp(element: ReactElement) {
      appHtml = renderToString(element);
    },
    setStatus(code: number) {
      statusCode = code;
    },
    redirect(url: string) {
      redirect = url;
      statusCode = 302;
    },
  };

  await matched.handler(req, res);

  return { appHtml, graphqlCache, statusCode, redirect };
}
