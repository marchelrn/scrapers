-- +goose Up
-- Fitur Secret Vault dihapus dari sistem: tidak ada lagi endpoint /secrets,
-- halaman "Secret Vault" di frontend, maupun resolusi kredensial pada worker.
-- Konsekuensinya tabel secrets tidak lagi memiliki pemilik di sisi kode.
--
-- PERHATIAN: menjalankan migrasi ini menghapus seluruh kredensial yang pernah
-- disimpan pada tabel secrets secara permanen. Pastikan tidak ada nilai yang
-- masih dibutuhkan (mis. cookie sesi atau API key target) sebelum `goose up`.
DROP TABLE IF EXISTS secrets;

-- Parameter warisan fitur vault pada konfigurasi lama. Tanpa penghapusan ini,
-- baris 'auth_type' dan 'secret_reference' tetap tampil pada halaman detail
-- konfigurasi meskipun tidak lagi dipakai oleh metode scraping mana pun.
DELETE FROM config_parameters
WHERE parameter_name IN ('auth_type', 'secret_reference');

-- +goose Down
-- Struktur tabel dibuat ulang, tetapi isinya tidak dapat dikembalikan: nilai
-- kredensial dan parameter warisan sudah hilang pada saat migrasi Up berjalan.
CREATE TABLE IF NOT EXISTS secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    secret_type VARCHAR(50) NOT NULL CHECK (secret_type IN ('api_key', 'bearer_token', 'basic_auth', 'cookie')),
    secret_value TEXT NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_secrets_created_by ON secrets(created_by);
