import { z } from "zod";
import { optionalEnv, requiredEnv } from "@/lib/env";

/**
 * X (Twitter) API v2 trends lookup: https://api.x.com/2/trends/by/woeid/:id
 * Requires a Pro-tier (or higher) app-only Bearer token. WOEID defaults to 1
 * (worldwide); override with X_TRENDS_WOEID (e.g. a specific country/metro).
 */

const X_API_BASE_URL = "https://api.x.com/2";
const DEFAULT_WOEID = "1";

const xTrendsResponseSchema = z.object({
  data: z.array(
    z.object({
      trend_name: z.string(),
      tweet_count: z.number().int().nonnegative().nullable().optional(),
    }),
  ),
});

export interface XTrend {
  readonly name: string;
  readonly tweetCount: number | null;
}

export async function getXTrendingTopics(woeid?: string): Promise<XTrend[]> {
  const token = requiredEnv("X_BEARER_TOKEN");
  const response = await fetch(
    `${X_API_BASE_URL}/trends/by/woeid/${woeid ?? optionalEnv("X_TRENDS_WOEID") ?? DEFAULT_WOEID}`,
    {
      headers: { authorization: `Bearer ${token}` },
      redirect: "error",
    },
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`X trends request failed (${response.status}): ${text.slice(0, 500)}`);
  }
  const payload = xTrendsResponseSchema.parse(JSON.parse(text));
  return payload.data.map((trend) => ({
    name: trend.trend_name,
    tweetCount: trend.tweet_count ?? null,
  }));
}
