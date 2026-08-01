-- The server needs an authoritative family timezone to validate quest dates;
-- otherwise a kid can submit arbitrary past/future dates to repeat a daily.
alter table families add column if not exists timezone text;
alter table families add constraint families_timezone_nonempty
  check (timezone is null or length(trim(timezone)) > 0) not valid;
