-- +goose Up
SELECT 'up SQL query';
CREATE TABLE IF NOT EXISTS scraping_results
(
    id          SERIAL PRIMARY KEY,
    job_id      UUID NOT NULL REFERENCES scraping_jobs(id) ON DELETE CASCADE,
    result_json JSONB,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scraping_results_job_id ON scraping_results(job_id);

-- +goose Down
SELECT 'down SQL query';
DROP TABLE IF EXISTS scraping_results;
