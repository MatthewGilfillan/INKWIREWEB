-- A recurring meeting ID can serve many lessons. Bind processing to the exact
-- Zoom occurrence UUID; an occurrence can belong to only one lesson.
DROP INDEX zoom_owned_meetings;
CREATE UNIQUE INDEX zoom_owned_occurrences ON zoom_lessons(meeting_uuid)
 WHERE connection_user_id IS NOT NULL AND meeting_uuid IS NOT NULL AND meeting_uuid!='';
ALTER TABLE zoom_weekly_meetings ADD COLUMN connection_user_id TEXT REFERENCES user(id);
ALTER TABLE zoom_weekly_meetings ADD COLUMN auto_recap INTEGER NOT NULL DEFAULT 0;
ALTER TABLE zoom_weekly_meetings ADD COLUMN auto_quiz INTEGER NOT NULL DEFAULT 0;
ALTER TABLE zoom_lessons ADD COLUMN auto_quiz INTEGER NOT NULL DEFAULT 0;
ALTER TABLE zoom_lessons ADD COLUMN quiz_status TEXT NOT NULL DEFAULT 'off';
ALTER TABLE zoom_lessons ADD COLUMN next_quiz_lesson_id TEXT;
ALTER TABLE zoom_lessons ADD COLUMN transcript_source TEXT NOT NULL DEFAULT '';
ALTER TABLE zoom_lessons ADD COLUMN weekly_weekday INTEGER;
ALTER TABLE zoom_lessons ADD COLUMN occurrence_started_at TEXT;
