-- Application-owned tables. Classroom access is assigned separately from registration.
CREATE TABLE activation_links (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX activation_links_expiry_idx ON activation_links(expires_at);
CREATE TABLE email_action_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE email_delivery_budget (day TEXT PRIMARY KEY, count INTEGER NOT NULL);
CREATE TABLE app_schema (id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL);
INSERT INTO app_schema (id, version) VALUES (1, 1);
