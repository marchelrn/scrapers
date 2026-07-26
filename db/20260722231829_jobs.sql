-- +goose Up
SELECT 'up SQL query';
CREATE TABLE IF NOT EXISTS scraping_jobs
(
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id   UUID NOT NULL REFERENCES scraping_configs(id) ON DELETE CASCADE,
    status      VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed')),
    started_at  TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    worker_name VARCHAR(255)
);

CREATE INDEX idx_scraping_jobs_config_id ON scraping_jobs(config_id);
CREATE INDEX idx_scraping_jobs_status ON scraping_jobs(status);

-- +goose Down
SELECT 'down SQL query';
DROP TABLE IF EXISTS scraping_jobs;
