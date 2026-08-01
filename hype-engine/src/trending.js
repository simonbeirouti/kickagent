/**
 * TrendingTopics — mocked platform-level trending source.
 *
 * Mirrors what the KICK API could provide: e.g. GET /public/v1/categories
 * sorted by live viewers, or a trending-keywords feed. The assistant compares
 * this list against what chat is actually discussing (TopicTracker) and
 * suggests the gaps — "this is hot on KICK right now and your chat hasn't
 * touched it".
 *
 * To go live, replace `list()` with a fetch + cache against the real
 * endpoint; consumers only depend on an ordered array of lowercase keywords
 * (hottest first).
 */

const MOCK_TRENDING = ['poker', 'slots', 'giveaway', 'irl', 'vegas', 'blackjack'];

export class TrendingTopics {
  constructor(topics = MOCK_TRENDING) {
    this.topics = topics.map((t) => t.toLowerCase());
  }

  /**
   * Ordered trending keywords, hottest first. `now` is unused by the mock but
   * part of the contract so a live source can refresh on a clock.
   */
  list(now) {
    return this.topics;
  }
}
