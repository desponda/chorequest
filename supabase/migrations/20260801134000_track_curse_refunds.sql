-- Track whether resolving a curse returned its deducted coins. Without this,
-- reopening a forgiven curse can be used to mint coins through repeated refunds.
alter table curse_instances
  add column if not exists refunded boolean not null default false;
