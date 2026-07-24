-- +goose Up
SELECT 'up SQL query';
CREATE TABLE IF NOT EXISTS websites
(
    id              SERIAL PRIMARY KEY,
    project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    base_url        VARCHAR(500) NOT NULL,
    login_required  BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_websites_project_id ON websites(project_id);

-- +goose Down
SELECT 'down SQL query';
DROP TABLE website