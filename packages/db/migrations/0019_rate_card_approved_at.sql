-- =====================================================================
-- 0019 Rate-card approval timestamp.
-- rate_cards shipped (migration 0007) with created_by and approved_by for
-- maker-checker but, unlike fee_schedules, without approved_at. The pricing
-- admin records when a card was approved, so add the column to match
-- fee_schedules and keep the approval timestamp on the row.
-- =====================================================================

ALTER TABLE rate_cards ADD COLUMN approved_at timestamptz;
