import { graphql } from 'graphql';
import type { GraphQLSchema } from 'graphql';
import type { GraphQLExecutor } from '../../shared/types/index.ts';

export function createServerExecutor(schema: GraphQLSchema): GraphQLExecutor {
  return async (query, variables) => {
    const result = await graphql({ schema, source: query, variableValues: variables });
    return {
      data: result.data as any,
      errors: result.errors?.map((e) => ({ message: e.message })),
    };
  };
}
