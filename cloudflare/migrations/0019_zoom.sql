-- OAuth credentials are encrypted by the worker before storage. Never expose
-- access/refresh tokens, host start URLs, or raw transcripts to a family timeline.
CREATE TABLE zoom_connections (
 user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
 zoom_user_id TEXT NOT NULL,
 account_id TEXT NOT NULL,
 display_name TEXT NOT NULL,
 credentials TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 refresh_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE zoom_oauth_states (
 state_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
CREATE TABLE zoom_lessons (
 class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
 lesson_id TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 connection_user_id TEXT REFERENCES user(id),
 meeting_id TEXT NOT NULL,
 meeting_uuid TEXT,
 join_url TEXT NOT NULL,
 passcode TEXT NOT NULL DEFAULT '',
 recording_url TEXT NOT NULL DEFAULT '',
 meeting_state TEXT NOT NULL DEFAULT 'scheduled',
 auto_recap INTEGER NOT NULL DEFAULT 0,
 recap_status TEXT NOT NULL DEFAULT 'off',
 recap_summary TEXT NOT NULL DEFAULT '',
 recap_updated_at INTEGER,
 updated_by TEXT NOT NULL REFERENCES user(id),
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(class_id,lesson_id)
);
-- Only single-occurrence meetings created by Ink Wire are automatically mapped.
CREATE UNIQUE INDEX zoom_owned_meetings ON zoom_lessons(meeting_id) WHERE connection_user_id IS NOT NULL;
CREATE TABLE zoom_recap_jobs (
 class_id TEXT NOT NULL,
 lesson_id TEXT NOT NULL,
 meeting_uuid TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 attempts INTEGER NOT NULL DEFAULT 0,
 available_at INTEGER NOT NULL,
 lease_until INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(class_id,lesson_id,meeting_uuid),
 FOREIGN KEY(class_id,lesson_id) REFERENCES zoom_lessons(class_id,lesson_id) ON DELETE CASCADE
);
