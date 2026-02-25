export const SONGS_QUERY = `
  query Songs {
    songs {
      id
      title
      author
    }
  }
`;

export const SONG_QUERY = `
  query Song($id: String!) {
    song(id: $id) {
      id
      title
      author
      rawText
    }
  }
`;
