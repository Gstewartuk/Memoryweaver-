-- Run these SQL statements in the Supabase SQL editor

CREATE TABLE IF NOT EXISTS children (
  id serial primary key,
  name text not null,
  birthday timestamptz
);

CREATE TABLE IF NOT EXISTS memories (
  id serial primary key,
  child_id integer references children(id),
  note text,
  image_path text,
  taken_at timestamptz,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS usage (
  id serial primary key,
  user_id uuid not null,
  period_start timestamptz not null,
  calls integer not null default 0,
  UNIQUE (user_id, period_start)
);

-- Create Storage buckets in Supabase UI:
-- - Bucket "memories"  (images)
-- - Bucket "pdfs"      (generated PDFs)
