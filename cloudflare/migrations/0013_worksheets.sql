CREATE TABLE worksheets (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
  pdf_key TEXT NOT NULL,
  pages_json TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES user(id),
  created_at INTEGER NOT NULL
);
CREATE INDEX worksheets_class_idx ON worksheets(class_id, created_at);
CREATE TABLE worksheet_states (
  worksheet_id TEXT NOT NULL REFERENCES worksheets(id) ON DELETE CASCADE,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(worksheet_id, learner_id)
);
CREATE TABLE worksheet_marks (
  worksheet_id TEXT NOT NULL REFERENCES worksheets(id) ON DELETE CASCADE,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES user(id),
  layer TEXT NOT NULL CHECK(layer IN ('teacher','student')),
  data_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(worksheet_id, learner_id, id)
);
CREATE TABLE worksheet_publications (
  worksheet_id TEXT NOT NULL REFERENCES worksheets(id) ON DELETE CASCADE,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  snapshot_key TEXT NOT NULL,
  published_at INTEGER NOT NULL,
  PRIMARY KEY(worksheet_id, learner_id)
);
