-- +goose Up
CREATE TABLE IF NOT EXISTS schedules
(
    id              SERIAL PRIMARY KEY,
    config_id       UUID NOT NULL REFERENCES scraping_configs(id) ON DELETE CASCADE,
    cron_expression VARCHAR(100) NOT NULL,
    timezone        VARCHAR(100) DEFAULT 'Asia/Makassar',
    enabled         BOOLEAN DEFAULT TRUE,
    next_run        TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_schedules_config_id ON schedules(config_id);

-- +goose Down
DROP TABLE IF EXISTS schedules;