-- Teacher notebooks use their own storage and never become student roster records.
CREATE TABLE teacher_notebook_sections (
 class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
 learner_id TEXT NOT NULL CHECK(learner_id='teacher'), id TEXT NOT NULL,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120), created_at INTEGER NOT NULL,
 PRIMARY KEY(class_id,learner_id,id)
);
CREATE TABLE teacher_notebook_pages (
 class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
 learner_id TEXT NOT NULL CHECK(learner_id='teacher'), id TEXT NOT NULL,
 section_id TEXT NOT NULL, title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
 kind TEXT NOT NULL CHECK(kind='note'), document_json TEXT, y_state BLOB,
 version INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL,
 PRIMARY KEY(class_id,learner_id,id)
);
CREATE TABLE notebook_item_meta (
 class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
 book_owner TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('section','page')),
 item_id TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}', revision INTEGER NOT NULL DEFAULT 1,
 updated_at INTEGER NOT NULL, PRIMARY KEY(class_id,book_owner,kind,item_id)
);
CREATE TABLE notebook_page_versions (
 class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE, book_owner TEXT NOT NULL,
 page_id TEXT NOT NULL, revision INTEGER NOT NULL, document_json TEXT NOT NULL,
 saved_at INTEGER NOT NULL, saved_by TEXT NOT NULL,
 PRIMARY KEY(class_id,book_owner,page_id,revision)
);
CREATE TABLE notebook_section_unlocks (
 class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE, book_owner TEXT NOT NULL,
 section_id TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL, PRIMARY KEY(class_id,book_owner,section_id,user_id)
);

-- Preserve existing page order when later edits change updated_at.
INSERT OR IGNORE INTO notebook_item_meta(class_id,book_owner,kind,item_id,metadata,revision,updated_at)
 SELECT class_id,learner_id,'page',id,json_object('position',updated_at),1,updated_at FROM notebook_pages;
