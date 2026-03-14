# Supabase: быстрый локальный тест (создать тест-пользователя и слово)

## 0) По вашей ошибке `Not IPv4 compatible`
Это нормальное предупреждение для Free-тарифа Supabase в режиме **Direct connection**.

Что сделать сначала:
1. Откройте `Connect` в Supabase.
2. Выберите `Method` = **Session Pooler**.
3. Используйте строку от pooler (у вас это `aws-...pooler.supabase.com:5432`).

> Для вашего проекта порт `5432` в pooler — это ок.

---

## 1) Подготовка
```bash
cd /workspace/smart-spell
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

## 2) Запуск одним командным вызовом
Можно передать вашу строку напрямую через `--database-url`.

```bash
python3 backend/supabase_smoke_test.py \
  --database-url 'postgresql://postgres.tizootfbwyohpjhkhpdw:DwNT/byqyH?#.4a@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' \
  --telegram-id 900000001 \
  --username smart_spell_test_user \
  --first-name SmartSpell \
  --word resilient \
  --definition 'способный быстро восстанавливаться после сложностей' \
  --relevance 7
```

Скрипт сам:
- URL-encode логин/пароль (важно для символов `/`, `?`, `#`),
- добавляет `sslmode=require`,
- создаёт/обновляет тестового пользователя,
- создаёт/обновляет слово,
- читает запись обратно.

## 3) Альтернатива через env
```bash
export DATABASE_URL='postgresql://postgres.tizootfbwyohpjhkhpdw:DwNT/byqyH?#.4a@aws-1-eu-west-1.pooler.supabase.com:5432/postgres'
python3 backend/supabase_smoke_test.py
```

## 4) Что вы увидите при успехе
В консоли будут строки:
- `✅ Подключение к БД успешно`
- `✅ Тестовый пользователь: ...`
- `✅ Добавлено/обновлено слово: ...`
- `✅ Проверка чтения: ...`

Если это есть — база подключена, запись и чтение работают локально.
