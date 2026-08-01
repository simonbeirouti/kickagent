import { defineTool } from "eve/tools";
import { z } from "zod";
import { requireKickConnectionId } from "@/lib/community-memory";
import { sendKickChatMessage } from "@/lib/kick/oauth";
import { findConnectionById, validKickAccessToken } from "@/lib/kick/repository";

export default defineTool({
  description:
    "Post a message into the connected Kick channel's live chat, as the streamer's own account. " +
    "Use sparingly — this is visible to the whole audience immediately, not a draft.",
  inputSchema: z.object({
    content: z.string().trim().min(1).max(500),
    replyToMessageId: z.string().trim().min(1).optional(),
  }),
  async execute(input, ctx) {
    const connectionId = requireKickConnectionId(ctx);
    const connection = await findConnectionById(connectionId);
    if (!connection || !connection.active) {
      throw new Error("Kick is not connected.");
    }
    const accessToken = await validKickAccessToken(connectionId);
    return sendKickChatMessage(accessToken, {
      content: input.content,
      broadcasterUserId: connection.kick_user_id,
      replyToMessageId: input.replyToMessageId,
    });
  },
});
