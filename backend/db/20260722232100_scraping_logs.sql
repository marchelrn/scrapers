-- +goose Up
CREATE TABLE IF NOT EXISTS scraping_logs
(
    id         SERIAL PRIMARY KEY,
    job_id     UUID NOT NULL REFERENCES scraping_jobs(id) ON DELETE CASCADE,
    level      VARCHAR(50) NOT NULL DEFAULT 'INFO' CHECK (level IN ('INFO', 'WARN', 'ERROR')),
    message    TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scraping_logs_job_id ON scraping_logs(job_id);
CREATE INDEX idx_scraping_logs_level ON scraping_logs(level);

-- +goose Down
DROP TABLE IF EXISTS scraping_logs;
