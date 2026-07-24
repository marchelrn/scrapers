-- +goose Up
SELECT 'up SQL query';
CREATE TABLE IF NOT EXISTS schedulers
(
    id              SERIAL PRIMARY KEY,
    config_id       INTEGER NOT NULL REFERENCES scrape_configs(id) ON DELETE CASCADE,
    cron_expression VARCHAR(100) NOT NULL,
    timezone        VARCHAR(100) DEFAULT 'Asia/Makassar',
    enabled         BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- +goose Down
SELECT 'down SQL query';
DROP TABLE schedulers;