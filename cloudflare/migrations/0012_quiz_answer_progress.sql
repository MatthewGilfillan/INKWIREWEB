-- Submitted answers are immutable before feedback is revealed.
ALTER TABLE quiz_attempts ADD COLUMN answer_progress TEXT NOT NULL DEFAULT '[]'
  CHECK (json_valid(answer_progress) AND json_type(answer_progress) = 'array');
