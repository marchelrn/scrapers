-- +goose Up
SELECT 'up SQL query';
CREATE TABLE IF NOT EXISTS scrape_configs
(
    id          SERIAL PRIMARY KEY,
    website_id  INTEGER NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    method      VARCHAR(50) NOT NULL CHECK (method IN ('css', 'xpath', 'regex', 'api', 'browser')),
    selector    TEXT,
    attribute   VARCHAR(255),
    pagination  JSONB,
    enabled     BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scrape_configs_website_id ON scrape_configs(website_id);
CREATE INDEX idx_scrape_configs_method ON scrape_configs(method);

-- +goose Down
SELECT 'down SQL query';
DROP TABLE scrape_configs;