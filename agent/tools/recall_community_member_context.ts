import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  recallMemberContext,
  requireKickConnectionId,
} from "@/lib/community-memory";

const inputSchema = z
  .object({
    kickUserId: z.string().regex(/^\d+$/u).max(20).optional(),
    username: z.string().trim().min(1).max(100).optional(),
    limit: z.number().int().min(1).max(20).default(10),
  })
  .refine((input) => input.kickUserId !== undefined || input.username !== undefined, {
    message: "Provide kickUserId or username.",
  });

export default defineTool({
  description:
    "Recall previously saved context for one Kick community member by stable user ID or exact username.",
  inputSchema,
  async execute(input, ctx) {
    return recallMemberContext(requireKickConnectionId(ctx), input);
  },
});
