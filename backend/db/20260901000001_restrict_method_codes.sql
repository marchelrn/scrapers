-- +goose Up
-- Sistem dibatasi hanya pada dua metode scraping: 'target_url' dan 'google_news'.
-- Metode 'google_search' dihapus dari registry; secara teknis metode tersebut hanya
-- alias yang mendelegasikan eksekusi ke google_news_scraper dengan skema parameter
-- yang identik (query, domain_filter, max_results, ai_instruction, deduplicate),
-- sehingga konfigurasi lama dapat dipindahkan tanpa kehilangan data.
UPDATE scraping_configs
SET method_code = 'google_news'
WHERE method_code = 'google_search';

-- +goose Down
-- Tidak ada rollback otomatis: setelah migrasi, konfigurasi 'google_search' dan
-- 'google_news' tidak lagi dapat dibedakan, sehingga rollback berisiko mengubah
-- konfigurasi google_news yang asli.
SELECT 1;
