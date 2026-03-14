# Backend + PostgreSQL setup

## Подключение к БД (упрощённое)
Backend использует простую схему из `psycopg2` + `dotenv`:
- `user`
- `password`
- `host`
- `port`
- `dbname`

Можно также задать `DATABASE_URL`, тогда backend возьмёт из него недостающие поля.

## Быстрый старт

### 1) Подготовить env
```bash
cd backend
cp .env.example .env
```

Откройте `backend/.env` и заполните параметры подключения.

Пример:
```env
user=postgres
password=<your-password>
host=db.your-project-ref.supabase.co
port=5432
dbname=postgres
DATABASE_URL=postgresql://postgres:<your-password>@db.your-project-ref.supabase.co:5432/postgres
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
psql "$DATABASE_URL" -f database/init_schema.sql
```

## Проверка, что backend живой
```bash
curl http://localhost:5000/health
```
Ожидается: `{"status":"ok"}`.

## Проверка, что БД подключена и пользователь создается
```bash
curl http://localhost:5000/api/profile
```
Если ответ с полями `user` и `profile` пришёл — backend подключился к БД.

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
