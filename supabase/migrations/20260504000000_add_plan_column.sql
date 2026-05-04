-- Add subscription plan tier to families.
-- Defaults to 'free'. Stripe webhooks will update this when paid plans land.
ALTER TABLE families
  ADD COLUMN plan text NOT NULL DEFAULT 'free'
  CHECK (plan IN ('free', 'family', 'legendary'));
