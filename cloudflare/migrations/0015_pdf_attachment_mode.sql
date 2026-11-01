ALTER TABLE worksheets ADD COLUMN display_mode TEXT NOT NULL DEFAULT 'printout' CHECK(display_mode IN ('printout','attachment'));
