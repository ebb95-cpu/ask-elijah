/**
 * Demographic definition for the pain-research pipeline.
 *
 * Every source module reads from this to decide what to search for. Keep
 * this tight — broader keywords = more noise, less signal. The current
 * focus is youth + amateur basketball players dealing with the mental
 * side of the game, since that's what Elijah's product is aimed at.
 */

export const RESEARCH_CONFIG = {
  // One-line description fed to Claude during synthesis so it knows who it's
  // clustering pain for.
  demographic:
    'High school, AAU, and early-college basketball players (13–20) who struggle with confidence, pressure, coach conflict, playing time, slumps, and the mental side of their game.',

  // Seed search queries used across YouTube, Google autocomplete, and Reddit.
  // Phrased the way a player would type them.
  seedQueries: [
    'how to stop freezing up in basketball games',
    'how to build basketball confidence',
    'basketball coach benched me',
    'i played bad in basketball',
    'basketball shooting slump',
    'how to stay confident basketball',
    'nervous before big basketball game',
    'basketball mental game',
    'bounce back after bad basketball game',
    'i feel stuck in basketball',
    'not getting playing time basketball',
    'basketball coach doesnt believe in me',
  ],

  // Subreddits to search. Order by signal quality — top few are gold for
  // this demographic, the rest are supporting context.
  subreddits: [
    'basketballtips',
    'BasketballTips',
    'Basketball',
    'basketballcoach',
    'AAU',
    'JuniorBasketball',
    'ncaabb',
  ],

  // YouTube: we search by query and also pull comments from the top N
  // videos per query. Cap here so one run doesn't blow the 10k-unit/day
  // quota.
  youtube: {
    videosPerQuery: 3,
    commentsPerVideo: 50,
  },

  // Reddit: results per search, top comments per thread.
  reddit: {
    postsPerQuery: 8,
    commentsPerPost: 20,
    // Only pull posts with at least this many upvotes — signal filter.
    minScore: 3,
  },

  // Autocomplete: how deep to recurse. 1 = just the seed query's suggestions.
  // 2 = suggestions-of-suggestions. Keep low to avoid combinatorial blow-up.
  autocomplete: {
    depth: 2,
    // Max suggestions kept per seed after dedupe.
    perSeed: 15,
  },
}

export type ResearchConfig = typeof RESEARCH_CONFIG
