-- C2.4: PRIVATE server-side PostgreSQL storage. Apply explicitly on a protected database.
-- Never run in GitHub Pages or expose direct access from a browser.
-- Application login/roles and encryption keys are mandatory outside this migration.
BEGIN;
CREATE TABLE IF NOT EXISTS organizer_review_workspace (
    organizer_id text PRIMARY KEY,
    revision bigint NOT NULL CHECK (revision >= 1),
    envelope text NOT NULL CHECK (octet_length(envelope) BETWEEN 1 AND 16777216),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT organizer_review_workspace_slug CHECK (
        organizer_id ~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$'
    )
);
COMMENT ON TABLE organizer_review_workspace IS
'Private, encrypted correction workspace. Envelope contains AES-256-GCM ciphertext, never a published source of truth.';
COMMENT ON COLUMN organizer_review_workspace.organizer_id IS
'Tenant key. Every query must be scoped through the authenticated backend.';
COMMENT ON COLUMN organizer_review_workspace.envelope IS
'Authenticated ciphertext; encryption key is held externally, not in PostgreSQL or Git.';
COMMIT;
