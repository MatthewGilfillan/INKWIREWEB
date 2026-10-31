-- One learner identity has a student connection and one or more parent connections.
-- Class roster slots reference that learner, so families follow the child across classes.
CREATE TABLE learners (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 80),
  user_id TEXT UNIQUE REFERENCES user(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE class_students (
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY(class_id, learner_id)
);
CREATE INDEX class_students_learner_idx ON class_students(learner_id);
CREATE TABLE learning_invites (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('class', 'student', 'family')),
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  learner_id TEXT REFERENCES learners(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  code_cipher TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  redeemed_by TEXT REFERENCES user(id) ON DELETE SET NULL,
  CHECK((kind = 'class' AND learner_id IS NULL) OR (kind != 'class' AND learner_id IS NOT NULL))
);
CREATE UNIQUE INDEX learning_invites_scope_idx ON learning_invites(class_id, kind, COALESCE(learner_id, ''));
CREATE TABLE learner_parents (
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  parent_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  parent_name TEXT NOT NULL CHECK(length(parent_name) BETWEEN 1 AND 80),
  connected_at INTEGER NOT NULL,
  PRIMARY KEY(learner_id, parent_id)
);
CREATE INDEX learner_parents_parent_idx ON learner_parents(parent_id);
