CREATE TABLE class_files (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('book','unit-plan','resource')),
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  ready INTEGER NOT NULL DEFAULT 0,
  ai_enabled INTEGER NOT NULL DEFAULT 0,
  student_download INTEGER NOT NULL DEFAULT 0,
  provider_file_id TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  lock_token TEXT,
  lock_until INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES user(id),
  created_at INTEGER NOT NULL
);
CREATE INDEX class_files_class ON class_files(class_id);
