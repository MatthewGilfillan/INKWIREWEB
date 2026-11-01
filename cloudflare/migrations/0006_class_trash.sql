-- Deletion is reversible and retains course plans and roster connections.
ALTER TABLE classes ADD COLUMN deleted_at INTEGER;
CREATE INDEX classes_owner_deleted_idx ON classes(owner_id, deleted_at);
