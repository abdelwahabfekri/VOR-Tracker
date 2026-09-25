-- ============================================================================
-- Migration: new document state 'records_request_due'
--
-- "Visit done" no longer means records were requested. After the visit the
-- document track moves to records_request_due ("Records request needed");
-- a separate "Records requested" action moves it to documents_requested once
-- the specialist office has actually been contacted.
--
-- Run this file ON ITS OWN, before 20260926b_workflow.sql: Postgres cannot use
-- a new enum value in the same transaction that added it.
-- Idempotent.
-- ============================================================================

alter type document_status add value if not exists 'records_request_due' after 'awaiting_appointment';
