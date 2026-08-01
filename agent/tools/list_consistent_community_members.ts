import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  listConsistentMembers,
  requireKickConnectionId,
} from "@/lib/community-memory";

export default defineTool({
  description:
    "List recurring Kick community members, ranked by active chat days without returning their full chat history.",
  inputSchema: z.object({
    minimumActiveDays: z.number().int().min(2).max(365).default(2),
    activeSince: z.iso.datetime({ offset: true }).optional(),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  async execute(input, ctx) {
    return listConsistentMembers(requireKickConnectionId(ctx), input);
  },
});
