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

export const suggestionSchema = z.object({
  basis: z.enum(["chat", "stream_context"]),
  suggestion: z.string().trim().min(1).max(140),
});

export type Suggestion = z.infer<typeof suggestionSchema>;
