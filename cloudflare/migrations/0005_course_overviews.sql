-- A teacher-only plan for each class. Student publication is a separate step.
CREATE TABLE course_overviews (
  class_id TEXT PRIMARY KEY REFERENCES classes(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  updated_by TEXT NOT NULL REFERENCES user(id),
  updated_at INTEGER NOT NULL
);
