BEGIN;

-- 1) New topics table without created_at and with normalized name removed.
CREATE TABLE IF NOT EXISTS dictionary_topics (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    UNIQUE (user_id, name)
);

-- 2) New dictionary words table without created_at and normalized_word.
CREATE TABLE IF NOT EXISTS dictionary_words_v2 (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word TEXT NOT NULL,
    definition TEXT NOT NULL,
    relevance SMALLINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, word)
);

-- 3) New M2M table that stores topic_id (not topic string in words table).
CREATE TABLE IF NOT EXISTS dictionary_word_topics_v2 (
    word_id BIGINT NOT NULL REFERENCES dictionary_words_v2(id) ON DELETE CASCADE,
    topic_id BIGINT NOT NULL REFERENCES dictionary_topics(id) ON DELETE CASCADE,
    PRIMARY KEY (word_id, topic_id)
);

-- Optional data migration from legacy structures (if they exist).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'dictionary_words'
    ) THEN
        INSERT INTO dictionary_words_v2 (user_id, word, definition, relevance, updated_at)
        SELECT
            user_id,
            word,
            definition,
            COALESCE(relevance, 0),
            COALESCE(updated_at, NOW())
        FROM dictionary_words
        ON CONFLICT (user_id, word) DO NOTHING;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'topics'
    ) THEN
        INSERT INTO dictionary_topics (user_id, name)
        SELECT DISTINCT user_id, name
        FROM topics
        ON CONFLICT (user_id, name) DO NOTHING;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'dictionary_word_topics'
    ) AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'dictionary_word_topics' AND column_name = 'normalized_word'
    ) THEN
        INSERT INTO dictionary_word_topics_v2 (word_id, topic_id)
        SELECT DISTINCT dw2.id, dt.id
        FROM dictionary_word_topics dwt
        JOIN dictionary_words_v2 dw2
            ON dw2.user_id = dwt.user_id
           AND lower(dw2.word) = dwt.normalized_word
        JOIN topics t
            ON t.id = dwt.topic_id
        JOIN dictionary_topics dt
            ON dt.user_id = t.user_id
           AND dt.name = t.name
        ON CONFLICT (word_id, topic_id) DO NOTHING;
    END IF;
END $$;

-- Replace old tables with optimized ones.
DROP TABLE IF EXISTS dictionary_word_topics;
DROP TABLE IF EXISTS dictionary_words;
DROP TABLE IF EXISTS topics;
DROP TABLE IF EXISTS telegram_auth_payloads;

ALTER TABLE dictionary_words_v2 RENAME TO dictionary_words;
ALTER TABLE dictionary_word_topics_v2 RENAME TO dictionary_word_topics;

-- Useful indexes for endpoint filters and joins.
CREATE INDEX IF NOT EXISTS idx_dictionary_words_user_word ON dictionary_words (user_id, word);
CREATE INDEX IF NOT EXISTS idx_dictionary_word_topics_topic_id ON dictionary_word_topics (topic_id);
CREATE INDEX IF NOT EXISTS idx_dictionary_topics_user_name ON dictionary_topics (user_id, name);

COMMIT;
