CREATE TABLE course_resources (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('book','unit-plan','resource')),
  bytes INTEGER NOT NULL CHECK(bytes > 0),
  provider_file_id TEXT,
  created_by TEXT NOT NULL REFERENCES user(id),
  created_at INTEGER NOT NULL
);
CREATE INDEX course_resources_class ON course_resources(class_id);
CREATE TABLE quiz_drafts (
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  course_revision INTEGER NOT NULL,
  quiz_revision INTEGER NOT NULL,
  content TEXT NOT NULL,
  review_notes TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_by TEXT NOT NULL REFERENCES user(id),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(class_id,lesson_id)
);
CREATE TABLE quiz_ai_jobs (
  class_id TEXT PRIMARY KEY REFERENCES classes(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  until_at INTEGER NOT NULL,
  result TEXT
);
