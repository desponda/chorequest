-- Allow 'denied' status so denials are soft-deleted (audit trail) instead of hard-deleted.
ALTER TABLE redemptions DROP CONSTRAINT redemptions_status_check;
ALTER TABLE redemptions ADD CONSTRAINT redemptions_status_check
  CHECK (status IN ('pending', 'approved', 'denied'));
