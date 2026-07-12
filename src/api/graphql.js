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

function searchAnimes(search, limit, page) {
  return buildRequest(`
    query SearchAnimes($search: String, $limit: PositiveInt, $page: PositiveInt) {
      animes(search: $search, limit: $limit, page: $page) {
        ${ANIME_CARD_FIELDS}
      }
    }
  `, { search: search, limit: limit || 20, page: page || 1 });
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
    query AnimesByIds($ids: String, $limit: PositiveInt) {
      animes(ids: $ids, limit: $limit) {
        ${ANIME_CARD_FIELDS}
      }
    }
  `, { ids: ids.join(','), limit: ids.length });
}

function popularAnimes(limit, page) {
  return buildRequest(`
    query PopularAnimes($limit: PositiveInt, $page: PositiveInt) {
      animes(order: popularity, limit: $limit, page: $page) {
        ${ANIME_CARD_FIELDS}
      }
    }
  `, { limit: limit || 20, page: page || 1 });
}

function ongoingAnimes(limit, page) {
  return buildRequest(`
    query OngoingAnimes($limit: PositiveInt, $page: PositiveInt) {
      animes(status: "ongoing", order: popularity, limit: $limit, page: $page) {
        ${ANIME_CARD_FIELDS}
      }
    }
  `, { limit: limit || 20, page: page || 1 });
}

function releasedAnimes(limit, page) {
  return buildRequest(`
    query ReleasedAnimes($limit: PositiveInt, $page: PositiveInt) {
      animes(status: "released", order: "aired_on", limit: $limit, page: $page) {
        ${ANIME_CARD_FIELDS}
      }
    }
  `, { limit: limit || 20, page: page || 1 });
}

function announcedAnimes(limit, page) {
  return buildRequest(`
    query AnnouncedAnimes($limit: PositiveInt, $page: PositiveInt) {
      animes(status: "anons", order: "aired_on", limit: $limit, page: $page) {
        ${ANIME_CARD_FIELDS}
      }
    }
  `, { limit: limit || 20, page: page || 1 });
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
