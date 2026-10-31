CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  media_type TEXT NOT NULL CHECK (media_type IN ('CAROUSEL','REEL')),
  caption TEXT NOT NULL DEFAULT '',
  media_urls TEXT NOT NULL DEFAULT '[]',          -- JSON array, ordered
  scheduled_at TEXT,                              -- ISO UTC
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','publishing','published','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,                           -- ISO UTC, for backoff
  instagram_media_id TEXT,
  permalink TEXT,
  last_error TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_posts_status_sched ON posts(status, scheduled_at);

CREATE TABLE publish_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_logs_post ON publish_logs(post_id);
