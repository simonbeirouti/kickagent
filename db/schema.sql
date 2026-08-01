CREATE TABLE IF NOT EXISTS kick_connections (
  id uuid PRIMARY KEY,
  kick_user_id bigint NOT NULL UNIQUE,
  email text,
  display_name text NOT NULL,
  profile_picture text,
  channel_slug text NOT NULL,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  token_refresh_started_at timestamptz,
  scopes text[] NOT NULL DEFAULT '{}',
  subscription_ids text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  is_live boolean NOT NULL DEFAULT false,
  stream_title text,
  category_name text,
  category_id bigint,
  workflow_generation integer NOT NULL DEFAULT 1,
  last_webhook_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- statement-breakpoint
ALTER TABLE kick_connections
  ADD COLUMN IF NOT EXISTS token_refresh_started_at timestamptz;

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS app_sessions (
  token_hash text PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES kick_connections(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS app_sessions_connection_idx
  ON app_sessions (connection_id, expires_at DESC);

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS kick_webhook_events (
  event_message_id text PRIMARY KEY,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS chat_messages (
  message_id text PRIMARY KEY,
  event_message_id text NOT NULL UNIQUE,
  connection_id uuid NOT NULL REFERENCES kick_connections(id) ON DELETE CASCADE,
  sender_user_id bigint,
  sender_username text NOT NULL,
  sender_profile_picture text,
  content text NOT NULL,
  reply_to_message_id text,
  created_at timestamptz NOT NULL,
  window_start timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now()
);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS chat_messages_connection_created_idx
  ON chat_messages (connection_id, created_at DESC);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS chat_messages_window_idx
  ON chat_messages (connection_id, window_start, created_at);

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS analysis_windows (
  connection_id uuid NOT NULL REFERENCES kick_connections(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('processing', 'complete', 'failed')),
  suggestion text,
  basis text CHECK (basis IN ('chat', 'stream_context')),
  error text,
  generated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (connection_id, window_start)
);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS analysis_windows_latest_idx
  ON analysis_windows (connection_id, window_start DESC);

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS community_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES kick_connections(id) ON DELETE CASCADE,
  kick_user_id bigint NOT NULL,
  username text NOT NULL,
  profile_picture text,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  total_message_count integer NOT NULL DEFAULT 0 CHECK (total_message_count >= 0),
  observation_count integer NOT NULL DEFAULT 0 CHECK (observation_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, kick_user_id)
);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS community_members_consistency_idx
  ON community_members (connection_id, last_seen_at DESC);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS community_members_username_idx
  ON community_members (connection_id, lower(username));

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS community_member_activity (
  connection_id uuid NOT NULL REFERENCES kick_connections(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES community_members(id) ON DELETE CASCADE,
  activity_date date NOT NULL,
  message_count integer NOT NULL DEFAULT 1 CHECK (message_count > 0),
  first_message_at timestamptz NOT NULL,
  last_message_at timestamptz NOT NULL,
  PRIMARY KEY (connection_id, member_id, activity_date)
);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS community_member_activity_recent_idx
  ON community_member_activity (connection_id, activity_date DESC);

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS community_member_context (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES kick_connections(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES community_members(id) ON DELETE CASCADE,
  source_message_id text NOT NULL,
  observed_at timestamptz NOT NULL,
  context_summary text NOT NULL,
  chat_excerpt text,
  stream_title text,
  category_name text,
  facts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, source_message_id)
);

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS community_member_context_recent_idx
  ON community_member_context (connection_id, member_id, observed_at DESC);
