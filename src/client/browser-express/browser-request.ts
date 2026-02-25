import type { UniversalRequest, GraphQLExecutor } from '../../shared/types/index.ts';
import { parseQueryString } from '../../shared/utils/index.ts';

export function createBrowserRequest(
  path: string,
  method: string,
  params: Record<string, string>,
  graphql: GraphQLExecutor,
  body?: any
): UniversalRequest {
  const [pathname, search] = path.split('?');
  return {
    path: pathname ?? path,
    method,
    params,
    query: parseQueryString(search ?? ''),
    body,
    graphql,
  };
}
