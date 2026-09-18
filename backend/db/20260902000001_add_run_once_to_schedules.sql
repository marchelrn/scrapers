-- +goose Up
-- run_once = TRUE: jadwal dijalankan satu kali pada waktu cocok berikutnya,
-- lalu otomatis dinonaktifkan. last_run mencatat kapan eksekusi itu terjadi.
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS run_once BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS last_run TIMESTAMP WITH TIME ZONE;

-- +goose Down
ALTER TABLE schedules DROP COLUMN IF EXISTS run_once;
ALTER TABLE schedules DROP COLUMN IF EXISTS last_run;
