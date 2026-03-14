# Backend + Supabase local setup

## Новый рекомендуемый тип подключения
Теперь backend ориентирован на **Supabase Session Pooler** (как на вашем скриншоте):
- сначала читается `DATABASE_POOLER_DSN` (формат `user=... password=... host=...`),
- затем `DATABASE_POOLER_URL`,
- и только потом direct URL (`DATABASE_URL` / `DATABASE_DIRECT_URL`).

Это удобнее для локалки и IPv4-сетей.

## Быстрый старт

### 1) Подготовить env
```bash
cd backend
cp .env.example .env
```

Откройте `backend/.env` и вставьте строку из Supabase **Connection String → Session pooler** в `DATABASE_POOLER_DSN`.

Пример:
```env
DATABASE_POOLER_DSN=user=postgres.<project-ref> password=<your-password> host=aws-1-<region>.pooler.supabase.com port=5432 dbname=postgres
```

### 2) Установить зависимости и запустить backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Backend: `http://localhost:5000`

### 3) Применить схему БД (если таблиц еще нет)
```bash
cd /workspace/smart-spell
psql "$DATABASE_POOLER_URL" -f database/init_schema.sql
```

> Если используете только `DATABASE_POOLER_DSN`, выполните SQL через Supabase SQL Editor (содержимое `database/init_schema.sql`).

## Проверка, что backend живой
```bash
curl http://localhost:5000/health
```
Ожидается: `{"status":"ok"}`.

## Проверка, что БД подключена и пользователь создается
```bash
curl http://localhost:5000/api/profile
```
Если ответ с полями `user` и `profile` пришёл — backend подключился к БД, и test-user создан/обновлен.

## Локальная симуляция Telegram InitData

Сгенерировать локальный initData:
```bash
curl -X POST http://localhost:5000/api/test-user/starter-pack \
  -H "Content-Type: application/json" \
  -d '{"telegramId":1000000001,"username":"local_tester","firstName":"Local"}'
```

Потом можно обращаться как Telegram WebApp:
```bash
curl http://localhost:5000/api/profile \
  -H "X-Telegram-Init-Data: <initData_from_response>"
```

## Проверка, что уровень английского реально сохраняется
```bash
curl -X POST http://localhost:5000/api/profile \
  -H "Content-Type: application/json" \
  -d '{"englishLevel":"B1-B2"}'

curl http://localhost:5000/api/profile
```
Во втором ответе должно быть `profile.englishLevel = "B1-B2"`.

## Почему на фронте может не появляться окно выбора уровня
Окно показывается только когда `/api/profile` вернул профиль с пустым `englishLevel`.
Проверьте:
1. Backend реально запущен на `:5000`.
2. Frontend идет через Vite proxy (`/api -> http://127.0.0.1:5000`).
3. `/api/profile` в браузере/через curl не возвращает 4xx/5xx.
4. В БД у текущего test-user `english_level` действительно пустой (или сбросьте его).

## Частая ошибка подключения
Если в логе есть `could not translate host name`, значит проблема сети/DNS до Postgres host.
В этом случае используйте именно Session Pooler DSN/URL из Supabase.
