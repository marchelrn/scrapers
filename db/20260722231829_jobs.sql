-- +goose Up
SELECT 'up SQL query';
CREATE TABLE IF NOT EXISTS jobs
(
    id          SERIAL PRIMARY KEY,
    config_id   INTEGER NOT NULL REFERENCES scrape_configs(id) ON DELETE CASCADE,
    status      VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed', 'retry')),
    started_at  TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    message     TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_jobs_config_id ON jobs(config_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);
-- +goose Down
SELECT 'down SQL query';
DROP TABLE jobs;
