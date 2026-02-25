import type { Request, Response } from 'express';
import { graphql } from 'graphql';
import type { GraphQLSchema } from 'graphql';

export function createGraphQLEndpoint(schema: GraphQLSchema) {
  return async (req: Request, res: Response) => {
    const { query, variables } = req.body;
    if (typeof query !== 'string' || query.trim() === '') {
      res.status(400).json({ errors: [{ message: 'Missing query' }] });
      return;
    }
    const result = await graphql({ schema, source: query, variableValues: variables });
    const statusCode = result.errors?.length && !result.data ? 400 : 200;
    res.status(statusCode).json({
      data: result.data,
      errors: result.errors?.map((e) => ({ message: e.message })),
    });
  };
}
