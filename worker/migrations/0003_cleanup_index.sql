-- Index to make 48-hour auto-cleanup of published posts fast
CREATE INDEX IF NOT EXISTS idx_posts_cleanup ON posts(status, published_at);

