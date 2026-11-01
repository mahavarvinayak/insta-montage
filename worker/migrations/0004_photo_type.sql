CREATE TABLE posts_new (
  id TEXT PRIMARY KEY,
  media_type TEXT NOT NULL CHECK (media_type IN ('CAROUSEL','REEL','PHOTO')),
  caption TEXT NOT NULL DEFAULT '',
  media_urls TEXT NOT NULL DEFAULT '[]',
  scheduled_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','publishing','published','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  instagram_media_id TEXT,
  permalink TEXT,
  last_error TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO posts_new (id, media_type, caption, media_urls, scheduled_at, status, attempts, next_attempt_at, instagram_media_id, permalink, last_error, published_at, created_at, updated_at)
SELECT id, media_type, caption, media_urls, scheduled_at, status, attempts, next_attempt_at, instagram_media_id, permalink, last_error, published_at, created_at, updated_at FROM posts;

DROP TABLE posts;

ALTER TABLE posts_new RENAME TO posts;

CREATE INDEX IF NOT EXISTS idx_posts_status_sched ON posts(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_posts_cleanup ON posts(status, published_at, updated_at);

