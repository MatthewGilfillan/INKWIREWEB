CREATE TABLE course_preparations (
  class_id TEXT PRIMARY KEY REFERENCES classes(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  content TEXT NOT NULL,
  lock_token TEXT,
  until_at INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
