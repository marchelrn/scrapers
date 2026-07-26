-- +goose Up
SELECT 'up SQL query';
CREATE TABLE IF NOT EXISTS users
(
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    role        VARCHAR(50) NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- +goose Down
SELECT 'down SQL query';
DROP TABLE IF EXISTS users;
