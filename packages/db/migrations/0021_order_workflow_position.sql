-- =====================================================================
-- 0021 Order workflow position. An order's `status` (order_status) can map
-- from several stages (e.g. loading and heading_to_dropoff both map to
-- in_progress), so the order must also record which workflow stage it is in.
-- workflow_id snapshots the workflow used at creation (docs/07: orders keep
-- the workflow version used at creation), independent of later vertical edits.
-- =====================================================================

ALTER TABLE orders
  ADD COLUMN workflow_id        uuid,
  ADD COLUMN current_stage_code text;
