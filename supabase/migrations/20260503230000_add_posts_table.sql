create table posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  excerpt      text,
  body         text not null default '',
  cover_url    text,
  sources      jsonb not null default '[]',
  published    boolean not null default false,
  published_at timestamptz,
  created_at   timestamptz default now()
);

alter table posts enable row level security;

-- Anyone (including anon) can read published posts
create policy "published posts are public"
  on posts for select
  using (published = true);
