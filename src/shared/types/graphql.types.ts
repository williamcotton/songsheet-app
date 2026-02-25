export interface GraphQLResult<T = any> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export type GraphQLExecutor = <T = any>(
  query: string,
  variables?: Record<string, any>
) => Promise<GraphQLResult<T>>;
