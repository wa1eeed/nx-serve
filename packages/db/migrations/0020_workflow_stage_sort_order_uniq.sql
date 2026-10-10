-- =====================================================================
-- 0020 Each workflow stage must have a distinct sort_order within its
-- workflow, so the order engine's "next stage" is unambiguous (docs/07).
-- The engine also validates this, but the constraint makes it durable.
-- =====================================================================

ALTER TABLE workflow_stages ADD CONSTRAINT workflow_stages_sort_order_uniq UNIQUE (workflow_id, sort_order);
