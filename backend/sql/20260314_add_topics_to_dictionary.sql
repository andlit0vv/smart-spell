BEGIN;

ALTER TABLE dictionary_words
  ADD COLUMN IF NOT EXISTS topic TEXT NULL;

CREATE TABLE IF NOT EXISTS topics (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, normalized_name)
);

CREATE TABLE IF NOT EXISTS dictionary_word_topics (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  normalized_word TEXT NOT NULL,
  topic_id BIGINT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, normalized_word, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_dictionary_word_topics_lookup
  ON dictionary_word_topics(user_id, normalized_word);

CREATE INDEX IF NOT EXISTS idx_topics_user_name
  ON topics(user_id, normalized_name);

COMMIT;
