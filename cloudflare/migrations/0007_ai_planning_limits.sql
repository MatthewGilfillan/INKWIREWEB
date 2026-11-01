-- Only request counters are retained, never prompts, generated text or API keys.
CREATE TABLE ai_planning_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  next_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX ai_planning_limits_expiry_idx ON ai_planning_limits(expires_at);
