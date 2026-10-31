-- Teacher workspaces are available after email verification.
-- Access to each class is scoped to its owner and invited teachers.
CREATE TABLE classes (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
  subject TEXT NOT NULL DEFAULT '' CHECK(length(subject) <= 120),
  request_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(owner_id, request_id)
);
CREATE TABLE class_teachers (
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY(class_id, user_id)
);
CREATE INDEX class_teachers_user_idx ON class_teachers(user_id);
CREATE TABLE class_invites (
  class_id TEXT PRIMARY KEY REFERENCES classes(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE class_action_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
