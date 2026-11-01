CREATE TABLE lesson_quizzes (
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  questions TEXT NOT NULL,
  reflection_prompt TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL REFERENCES user(id),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(class_id, lesson_id)
);
CREATE TABLE quiz_attempts (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  learner_name TEXT NOT NULL,
  quiz_revision INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  submitted_at INTEGER,
  score INTEGER,
  total INTEGER NOT NULL CHECK(total BETWEEN 1 AND 20),
  answers TEXT,
  reflection TEXT NOT NULL DEFAULT '',
  FOREIGN KEY(class_id,lesson_id) REFERENCES lesson_quizzes(class_id,lesson_id) ON DELETE CASCADE,
  CHECK(score IS NULL OR score BETWEEN 0 AND total),
  CHECK((submitted_at IS NULL AND score IS NULL AND answers IS NULL) OR (submitted_at IS NOT NULL AND score IS NOT NULL AND answers IS NOT NULL))
);
CREATE INDEX quiz_attempts_lesson ON quiz_attempts(class_id,lesson_id,learner_id,submitted_at);
CREATE UNIQUE INDEX quiz_attempts_active ON quiz_attempts(class_id,lesson_id,learner_id) WHERE submitted_at IS NULL;
