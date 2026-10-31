-- Simple IP based throttle for the admin login form.
-- One row per IP; reset when the 15 minute window has elapsed.
CREATE TABLE IF NOT EXISTS auth_attempts (
  ip TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  first_at TEXT NOT NULL
);
