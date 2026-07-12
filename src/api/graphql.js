/**
 * GraphQL queries for Shikimori.
 * Fields verified against the live schema.
 */
const config = require('../config');

const ANIME_CARD_FIELDS = `
  id
  name
  russian
  english
  synonyms
  kind
  score
  status
  episodes
  episodesAired
  duration
  rating
  url
  malId
  description
  descriptionHtml
  descriptionSource
  airedOn { year month day date }
  releasedOn { year month day date }
  nextEpisodeAt
  poster { originalUrl mainUrl mainAltUrl }
  genres { name russian }
  studios { name }
  externalLinks { kind url }
`;

function graphqlPath() {
  return config.GRAPHQL_PATH;
}

function buildRequest(query, variables) {
  return {
    query: query,
    variables: variables || {}
  };
}

function searchAnimes(search, limit) {
  return buildRequest(`
    query SearchAnimes($search: String, $limit: Int) {
      animes(search: $search, limit: $limit) {
        ${ANIME_CARD_FIELDS}
      }
    }
  `, { search: search, limit: limit || 20 });
}

function getAnimeById(id) {
  return buildRequest(`
    query AnimeById($ids: String) {
      animes(ids: $ids, limit: 1) {
        ${ANIME_CARD_FIELDS}
      }
    }
  `, { ids: String(id) });
}

function getAnimesByIds(ids) {
  return buildRequest(`
    query AnimesByIds($ids: String, $limit: Int) {
      animes(ids: $ids, limit: $limit) {
        ${ANIME_CARD_FIELDS}
      }
    }
  `, { ids: ids.join(','), limit: ids.length });
}

function popularAnimes(limit) {
  return buildRequest(`
    query PopularAnimes($limit: Int) {
      animes(order: popularity, limit: $limit) {
        ${ANIME_CARD_FIELDS}
      }
    }
  `, { limit: limit || 20 });
}

function ongoingAnimes(limit) {
  return buildRequest(`
    query OngoingAnimes($limit: Int) {
      animes(status: "ongoing", order: popularity, limit: $limit) {
        ${ANIME_CARD_FIELDS}
      }
    }
  `, { limit: limit || 20 });
}

function releasedAnimes(limit) {
  return buildRequest(`
    query ReleasedAnimes($limit: Int) {
      animes(status: "released", order: "aired_on", limit: $limit) {
        ${ANIME_CARD_FIELDS}
      }
    }
  `, { limit: limit || 20 });
}

function announcedAnimes(limit) {
  return buildRequest(`
    query AnnouncedAnimes($limit: Int) {
      animes(status: "anons", order: "aired_on", limit: $limit) {
        ${ANIME_CARD_FIELDS}
      }
    }
  `, { limit: limit || 20 });
}

module.exports = {
  graphqlPath,
  searchAnimes,
  getAnimeById,
  getAnimesByIds,
  popularAnimes,
  ongoingAnimes,
  releasedAnimes,
  announcedAnimes
};
