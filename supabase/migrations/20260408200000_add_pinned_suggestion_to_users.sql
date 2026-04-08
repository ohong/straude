-- Add a flag to pin users in the "Suggested Friends" sidebar.
-- Pinned users appear last in the suggestion list.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_pinned_suggestion BOOLEAN NOT NULL DEFAULT false;
