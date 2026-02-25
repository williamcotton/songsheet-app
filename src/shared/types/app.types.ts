import type { ReactElement } from 'react';
import type { GraphQLExecutor } from './graphql.types.ts';

export interface UniversalRequest {
  path: string;
  method: string;
  params: Record<string, string>;
  query: Record<string, string>;
  body?: any;
  graphql: GraphQLExecutor;
}

export interface UniversalResponse {
  renderApp(element: ReactElement): void;
  setStatus(code: number): void;
  redirect(url: string): void;
}

export type RouteHandler = (req: UniversalRequest, res: UniversalResponse) => Promise<void> | void;

export interface UniversalApp {
  get(path: string, handler: RouteHandler): void;
  post(path: string, handler: RouteHandler): void;
}
