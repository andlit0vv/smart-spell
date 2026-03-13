BEGIN;

-- Minimal PostgreSQL schema for current Smart Spell MVP.
-- Focus: Telegram users + profile + dictionary words (+ local fake users).

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL UNIQUE,
    username TEXT,
    first_name TEXT NOT NULL,
    is_test_user BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (telegram_id > 0)
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_is_test_user ON users (is_test_user);

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT,
    bio TEXT,
    english_level TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dictionary_words (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word TEXT NOT NULL,
    normalized_word TEXT NOT NULL,
    definition TEXT NOT NULL,
    relevance SMALLINT NOT NULL DEFAULT 0 CHECK (relevance BETWEEN 0 AND 10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, normalized_word)
);

CREATE INDEX IF NOT EXISTS idx_dictionary_words_user_id ON dictionary_words (user_id);
CREATE INDEX IF NOT EXISTS idx_dictionary_words_word ON dictionary_words (word);

CREATE TABLE IF NOT EXISTS local_test_user_pool (
    id BIGSERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    is_reserved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (telegram_id > 0)
);

CREATE INDEX IF NOT EXISTS idx_local_test_user_pool_reserved ON local_test_user_pool (is_reserved);

COMMIT;
