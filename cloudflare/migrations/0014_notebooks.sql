CREATE TABLE notebook_sections (
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(class_id, learner_id, id)
);
CREATE TABLE notebook_pages (
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
  kind TEXT NOT NULL CHECK(kind IN ('note','worksheet')),
  document_json TEXT,
  y_state BLOB,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(class_id, learner_id, id)
);
