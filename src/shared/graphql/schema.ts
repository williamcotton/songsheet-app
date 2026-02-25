import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLList,
  GraphQLNonNull,
} from 'graphql';
import type { DataStore } from './types.ts';

export function createSchema(dataStore: DataStore): GraphQLSchema {
  const SongSummaryType = new GraphQLObjectType({
    name: 'SongSummary',
    fields: {
      id: { type: new GraphQLNonNull(GraphQLString) },
      title: { type: new GraphQLNonNull(GraphQLString) },
      author: { type: new GraphQLNonNull(GraphQLString) },
    },
  });

  const SongDataType = new GraphQLObjectType({
    name: 'SongData',
    fields: {
      id: { type: new GraphQLNonNull(GraphQLString) },
      title: { type: new GraphQLNonNull(GraphQLString) },
      author: { type: new GraphQLNonNull(GraphQLString) },
      rawText: { type: new GraphQLNonNull(GraphQLString) },
    },
  });

  const QueryType = new GraphQLObjectType({
    name: 'Query',
    fields: {
      songs: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(SongSummaryType))),
        resolve: () => dataStore.getSongs(),
      },
      song: {
        type: SongDataType,
        args: {
          id: { type: new GraphQLNonNull(GraphQLString) },
        },
        resolve: (_root, args: { id: string }) => dataStore.getSong(args.id),
      },
    },
  });

  return new GraphQLSchema({ query: QueryType });
}
