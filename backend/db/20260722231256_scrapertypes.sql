-- +goose Up
CREATE TABLE IF NOT EXISTS scraper_types
(
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    python_file VARCHAR(255) NOT NULL,
    description TEXT,
    is_active   BOOLEAN DEFAULT TRUE
);

-- Seed default scraper types
INSERT INTO scraper_types (name, python_file, description) VALUES
    ('CSS', 'css_scraper.py', 'Scraping menggunakan CSS selector'),
    ('XPath', 'xpath_scraper.py', 'Scraping menggunakan XPath expression'),
    ('Regex', 'regex_scraper.py', 'Scraping menggunakan Regular Expression'),
    ('API', 'api_scraper.py', 'Scraping melalui API endpoint'),
    ('Headless', 'headless_scraper.py', 'Scraping menggunakan headless browser');

-- +goose Down
DROP TABLE IF EXISTS scraper_types;
