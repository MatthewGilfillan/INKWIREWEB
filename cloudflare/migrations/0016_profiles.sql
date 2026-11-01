CREATE TABLE member_profiles (
  user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('none','avatar','photo')),
  avatar_json TEXT,
  photo BLOB,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  CHECK ((kind='avatar' AND avatar_json IS NOT NULL AND json_valid(avatar_json) AND photo IS NULL)
    OR (kind='photo' AND avatar_json IS NULL AND photo IS NOT NULL AND length(photo)<=204800)
    OR (kind='none' AND avatar_json IS NULL AND photo IS NULL))
);
