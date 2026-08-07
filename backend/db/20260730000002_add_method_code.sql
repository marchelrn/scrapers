-- +goose Up
ALTER TABLE scraping_configs ADD COLUMN IF NOT EXISTS method_code VARCHAR(100) DEFAULT 'target_url';

-- Kita langsung DROP COLUMN agar masalah foreign key terselesaikan secara paksa
ALTER TABLE scraping_configs DROP COLUMN IF EXISTS scraper_type_id CASCADE;

-- +goose Down
ALTER TABLE scraping_configs DROP COLUMN IF EXISTS method_code;
ALTER TABLE scraping_configs ADD COLUMN scraper_type_id INTEGER;
