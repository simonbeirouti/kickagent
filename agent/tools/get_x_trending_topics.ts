import { defineTool } from "eve/tools";
import { z } from "zod";
import { getXTrendingTopics } from "@/lib/x/trending";

export default defineTool({
  description:
    "Fetch current trending topics from X (Twitter). Use this to find a live talking point before " +
    "asking Kick chat for their thoughts — pick one trend and phrase a natural question about it, " +
    "don't just paste the raw trend name.",
  inputSchema: z.object({
    woeid: z
      .string()
      .regex(/^\d+$/u)
      .optional()
      .describe("Yahoo! Where On Earth ID for a specific location. Omit for worldwide trends."),
    limit: z.number().int().min(1).max(50).default(10),
  }),
  async execute(input) {
    const trends = await getXTrendingTopics(input.woeid);
    return { trends: trends.slice(0, input.limit) };
  },
});
