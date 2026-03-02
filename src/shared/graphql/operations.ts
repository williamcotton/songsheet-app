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

export const UPDATE_SONG_MUTATION = `
  mutation UpdateSong($id: String!, $rawText: String!) {
    updateSong(id: $id, rawText: $rawText) {
      id
      title
      author
      rawText
    }
  }
`;
