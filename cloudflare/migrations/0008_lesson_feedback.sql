CREATE TABLE lesson_feedback (
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  draft TEXT NOT NULL,
  published TEXT,
  job_token TEXT,
  job_until INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT NOT NULL REFERENCES user(id),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(class_id, lesson_id)
);
-- Teacher-only demo profiles never create authentication identities or grant
-- anonymous family access. Real parent links still require verified accounts.
CREATE TABLE demo_parent_profiles (
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES user(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(class_id, learner_id)
);
