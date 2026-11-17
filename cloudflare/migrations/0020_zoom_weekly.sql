CREATE TABLE zoom_weekly_meetings (
 class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
 weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
 revision INTEGER NOT NULL DEFAULT 1,
 meeting_id TEXT NOT NULL,
 join_url TEXT NOT NULL,
 passcode TEXT NOT NULL DEFAULT '',
 updated_by TEXT NOT NULL REFERENCES user(id),
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(class_id,weekday)
);
