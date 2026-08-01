import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  requireKickConnectionId,
  saveMemberObservation,
} from "@/lib/community-memory";

export default defineTool({
  description:
    "Save one meaningful, durable observation about a recurring Kick community member. Do not use this to archive ordinary chat messages.",
  inputSchema: z.object({
    kickUserId: z.string().regex(/^\d+$/u).max(20),
    username: z.string().trim().min(1).max(100),
    profilePicture: z.string().url().max(2_000).optional(),
    sourceMessageId: z.string().trim().min(1).max(200),
    observedAt: z.iso.datetime({ offset: true }),
    contextSummary: z.string().trim().min(1).max(500),
    chatExcerpt: z.string().trim().min(1).max(500).optional(),
    streamTitle: z.string().trim().min(1).max(300).optional(),
    categoryName: z.string().trim().min(1).max(200).optional(),
    facts: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
  }),
  async execute(input, ctx) {
    return saveMemberObservation(requireKickConnectionId(ctx), input);
  },
});
