CREATE TABLE IF NOT EXISTS support_announcements (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  target TEXT NOT NULL DEFAULT '',
  agency TEXT NOT NULL DEFAULT '',
  period TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '경영',
  region TEXT NOT NULL DEFAULT '전국',
  scope TEXT NOT NULL DEFAULT 'all',
  updated_at TEXT NOT NULL DEFAULT '',
  fetched_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_announcements_category
  ON support_announcements(category);
CREATE INDEX IF NOT EXISTS idx_support_announcements_region
  ON support_announcements(region);
CREATE INDEX IF NOT EXISTS idx_support_announcements_scope
  ON support_announcements(scope);
CREATE INDEX IF NOT EXISTS idx_support_announcements_updated_at
  ON support_announcements(updated_at);
