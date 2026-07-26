-- +goose Up
SELECT 'up SQL query';
CREATE TABLE IF NOT EXISTS scraping_configs
(
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(255) NOT NULL,
    description      TEXT,
    scraper_type_id  INTEGER NOT NULL REFERENCES scraper_types(id) ON DELETE RESTRICT,
    created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    status           VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    schedule_enabled BOOLEAN DEFAULT FALSE,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scraping_configs_scraper_type_id ON scraping_configs(scraper_type_id);
CREATE INDEX idx_scraping_configs_created_by ON scraping_configs(created_by);
CREATE INDEX idx_scraping_configs_status ON scraping_configs(status);

-- +goose Down
SELECT 'down SQL query';
DROP TABLE IF EXISTS scraping_configs;