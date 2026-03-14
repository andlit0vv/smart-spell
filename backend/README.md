# Backend + Supabase local setup

## Почему выбран Direct Connection (а не Session Pooler)
Я выбрал **Direct Connection** как дефолт для этого репозитория, потому что:
1. Вы уже дали рабочий direct-host/port (`db.tizoot...:5432`) и это можно сразу запустить без дополнительных поисков region-specific pooler host.
2. Текущий Flask backend открывает короткие подключения на запрос — для локальной проверки этого достаточно.
3. Для будущего деплоя можно в любой момент подменить только `DATABASE_URL` на Session Pooler (код менять не нужно).

> Если на вашей сети Direct не подключится (часто IPv4-only сети), просто возьмите Session Pooler URL в Supabase и вставьте его в `DATABASE_URL`.

## Быстрый старт (минимум действий)

### 1) Подготовить env
```bash
cd backend
cp .env.example .env
```

`.env.example` уже содержит ваш URL с корректным URL-encoded паролем.

### 2) Установить зависимости и запустить backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Backend: `http://localhost:5000`

### 3) Автоматическая регистрация локального тест-пользователя
Ничего дополнительно делать не нужно: при первом запросе на `/api/profile` пользователь из `.env` создается автоматически.

Проверка:
```bash
curl http://localhost:5000/api/profile
```

## Симуляция Telegram initData (starter pack)

Сгенерировать локальный "пакет" Telegram-пользователя + initData:
```bash
curl -X POST http://localhost:5000/api/test-user/starter-pack \
  -H "Content-Type: application/json" \
  -d '{"telegramId":1000000001,"username":"local_tester","firstName":"Local"}'
```

В ответе будет `initData` и пример заголовков. Можно вызывать endpoint'ы как будто это Telegram WebApp:
```bash
curl http://localhost:5000/api/profile \
  -H "X-Telegram-Init-Data: <initData_from_response>"
```

## Проверка profile/dictionary в БД
```bash
# profile save
curl -X POST http://localhost:5000/api/profile \
  -H "Content-Type: application/json" \
  -d '{"name":"Local User","bio":"QA run","englishLevel":"B1-B2"}'

# add dictionary word
curl -X POST http://localhost:5000/api/dictionary \
  -H "Content-Type: application/json" \
  -d '{"word":"deploy","definition":"release app to server","relevance":8}'

# list dictionary
curl http://localhost:5000/api/dictionary
```

## Переключение пользователя
Без изменения `.env`, передайте заголовок:
```bash
curl http://localhost:5000/api/profile -H "X-Telegram-Id: 2000000002"
```
