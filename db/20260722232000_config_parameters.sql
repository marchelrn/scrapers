-- +goose Up
SELECT 'up SQL query';
CREATE TABLE IF NOT EXISTS config_parameters
(
    id              SERIAL PRIMARY KEY,
    config_id       UUID NOT NULL REFERENCES scraping_configs(id) ON DELETE CASCADE,
    parameter_name  VARCHAR(255) NOT NULL,
    parameter_value JSONB
);

CREATE INDEX idx_config_parameters_config_id ON config_parameters(config_id);

-- +goose Down
SELECT 'down SQL query';
DROP TABLE IF EXISTS config_parameters;
