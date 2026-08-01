import { z } from "zod";

export const kickTokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.coerce.number().positive(),
  refresh_token: z.string().min(1),
  scope: z.string().default(""),
  token_type: z.string().default("Bearer"),
});

export type KickToken = z.infer<typeof kickTokenSchema>;

export const kickUserResponseSchema = z.object({
  data: z
    .array(
      z.object({
        email: z.string().email().nullable().optional(),
        name: z.string().min(1),
        profile_picture: z.string().nullable().optional(),
        user_id: z.coerce.string(),
      }),
    )
    .min(1),
});

export const kickChannelResponseSchema = z.object({
  data: z
    .array(
      z.object({
        broadcaster_user_id: z.coerce.string(),
        category: z
          .object({
            id: z.coerce.string(),
            name: z.string(),
          })
          .nullable()
          .optional(),
        slug: z.string(),
        stream: z
          .object({
            is_live: z.boolean().default(false),
          })
          .nullable()
          .optional(),
        stream_title: z.string().nullable().optional(),
      }),
    )
    .min(1),
});

export const kickSubscriptionResponseSchema = z.object({
  data: z.array(
    z.object({
      error: z.string().nullable().optional(),
      name: z.string(),
      subscription_id: z.string().nullable().optional(),
    }),
  ),
});

const kickIdentitySchema = z.object({
  is_anonymous: z.boolean().optional(),
  profile_picture: z.string().nullable().optional(),
  user_id: z.coerce.string().nullable().optional(),
  username: z.string().nullable().optional(),
});

export const kickChatEventSchema = z.object({
  broadcaster: kickIdentitySchema.extend({ user_id: z.coerce.string() }),
  content: z.string(),
  created_at: z.string().datetime({ offset: true }),
  message_id: z.string().min(1),
  replies_to: z
    .object({
      message_id: z.string(),
    })
    .nullable()
    .optional(),
  sender: kickIdentitySchema,
});

export const kickLivestreamStatusEventSchema = z.object({
  broadcaster: kickIdentitySchema.extend({ user_id: z.coerce.string() }),
  is_live: z.boolean(),
  title: z.string().nullable().optional(),
});

export const kickLivestreamMetadataEventSchema = z.object({
  broadcaster: kickIdentitySchema.extend({ user_id: z.coerce.string() }),
  metadata: z.object({
    category: z
      .object({
        id: z.coerce.string(),
        name: z.string(),
      })
      .nullable()
      .optional(),
    title: z.string().nullable().optional(),
  }),
});

export const kickSendChatMessageResponseSchema = z.object({
  data: z.object({
    is_sent: z.boolean(),
    message_id: z.string(),
  }),
  message: z.string().optional(),
});

export const streamAnalysisSchema = z.object({
  basis: z.enum(["chat", "stream_context"]),
  hypeScore: z.number().int().min(0).max(100),
  summary: z.string().trim().min(1).max(280),
  suggestion: z.string().trim().min(1).max(140),
  topics: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(48),
        percentage: z.number().int().min(0).max(100),
      }),
    )
    .max(3),
});

export type StreamAnalysis = z.infer<typeof streamAnalysisSchema>;

export const chatSummarySchema = z.object({
  interest: z.enum(["low", "medium", "high"]),
  purpose: z.string().trim().min(1).max(160),
  requests: z.array(z.string().trim().min(1).max(120)).max(5),
  summary: z.string().trim().min(1).max(280),
  suggestions: z.array(z.string().trim().min(1).max(140)).min(1).max(3),
  tone: z.string().trim().min(1).max(60),
});

export type ChatSummary = z.infer<typeof chatSummarySchema>;
