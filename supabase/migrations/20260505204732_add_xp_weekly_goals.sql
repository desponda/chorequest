-- XP, level, and weekly goal tracking per kid

ALTER TABLE kids ADD COLUMN xp integer NOT NULL DEFAULT 0;
ALTER TABLE kids ADD COLUMN level integer NOT NULL DEFAULT 1;
ALTER TABLE kids ADD COLUMN weekly_goal integer NOT NULL DEFAULT 5;
ALTER TABLE kids ADD COLUMN weekly_goal_paid_week date;
