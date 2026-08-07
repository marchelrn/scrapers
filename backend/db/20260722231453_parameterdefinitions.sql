-- +goose Up
CREATE TABLE IF NOT EXISTS parameter_definitions
(
    id              SERIAL PRIMARY KEY,
    scraper_type_id INTEGER NOT NULL REFERENCES scraper_types(id) ON DELETE CASCADE,
    parameter_name  VARCHAR(255) NOT NULL,
    label           VARCHAR(255) NOT NULL,
    data_type       VARCHAR(50) NOT NULL DEFAULT 'text' CHECK (data_type IN ('text', 'json', 'number', 'date')),
    required        BOOLEAN DEFAULT FALSE,
    default_value   TEXT,
    placeholder     VARCHAR(255)
);

CREATE INDEX idx_parameter_definitions_scraper_type_id ON parameter_definitions(scraper_type_id);

-- Seed parameter definitions for CSS scraper
INSERT INTO parameter_definitions (scraper_type_id, parameter_name, label, data_type, required, placeholder) VALUES
    (1, 'target_url', 'Target URL', 'text', TRUE, 'https://example.com/page'),
    (1, 'selector', 'CSS Selector', 'text', TRUE, '.class-name or #id'),
    (1, 'attribute', 'Attribute', 'text', FALSE, 'text, href, src, etc.');

-- Seed parameter definitions for XPath scraper
INSERT INTO parameter_definitions (scraper_type_id, parameter_name, label, data_type, required, placeholder) VALUES
    (2, 'target_url', 'Target URL', 'text', TRUE, 'https://example.com/page'),
    (2, 'xpath', 'XPath Expression', 'text', TRUE, '//div[@class="content"]');

-- Seed parameter definitions for Regex scraper
INSERT INTO parameter_definitions (scraper_type_id, parameter_name, label, data_type, required, placeholder) VALUES
    (3, 'target_url', 'Target URL', 'text', TRUE, 'https://example.com/page'),
    (3, 'pattern', 'Regex Pattern', 'text', TRUE, '<title>(.*?)</title>');

-- Seed parameter definitions for API scraper
INSERT INTO parameter_definitions (scraper_type_id, parameter_name, label, data_type, required, placeholder) VALUES
    (4, 'endpoint', 'API Endpoint', 'text', TRUE, 'https://api.example.com/v1/data'),
    (4, 'headers', 'Headers', 'json', FALSE, '{"Authorization": "Bearer ..."}'),
    (4, 'query', 'Query Parameters', 'json', FALSE, '{"page": 1, "limit": 100}');

-- Seed parameter definitions for Headless scraper
INSERT INTO parameter_definitions (scraper_type_id, parameter_name, label, data_type, required, placeholder) VALUES
    (5, 'target_url', 'Target URL', 'text', TRUE, 'https://example.com/page'),
    (5, 'selector', 'CSS Selector', 'text', TRUE, '.class-name or #id'),
    (5, 'wait_for', 'Wait For Selector', 'text', FALSE, '#loaded-content'),
    (5, 'attribute', 'Attribute', 'text', FALSE, 'text, href, src, etc.');

-- +goose Down
DROP TABLE IF EXISTS parameter_definitions;