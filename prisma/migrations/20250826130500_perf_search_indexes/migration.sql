-- Enable pg_trgm extension for trigram indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Speed up ILIKE/contains on Card.term and Card.definition
CREATE INDEX IF NOT EXISTS card_term_trgm_idx ON "Card" USING GIN (lower(term) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS card_definition_trgm_idx ON "Card" USING GIN (lower(definition) gin_trgm_ops);

-- Speed up ILIKE/contains on WritingSubmission text columns
CREATE INDEX IF NOT EXISTS writing_prompt_trgm_idx ON "WritingSubmission" USING GIN (lower(prompt) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS writing_submission_trgm_idx ON "WritingSubmission" USING GIN (lower(submission) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS writing_correction_trgm_idx ON "WritingSubmission" USING GIN (lower(correction) gin_trgm_ops);
