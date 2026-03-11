# Smart Spell (Standalone)

Проект полностью независим от Lovable: запуск, разработка и деплой выполняются локально и на любом вашем хостинге.

## 1) Как запустить сайт локально на ПК

### Требования
- Node.js 18+
- npm

Проверка версий:

```bash
node -v
npm -v
```

### Установка и старт

```bash
npm install
npm run dev
```

Откройте в браузере:
- `http://localhost:8080`

> Если порт 8080 занят, можно запустить на другом порту:
>
> ```bash
> npm run dev -- --port 5173
> ```

## 2) Доступ с других устройств в вашей сети (телефон/другой ПК)

Vite уже настроен на `host: 0.0.0.0`, поэтому сервер слушает все сетевые интерфейсы.

1. Узнайте локальный IP вашего ПК (например `192.168.1.42`).
2. Запустите `npm run dev`.
3. Откройте на другом устройстве: `http://<ВАШ_IP>:8080`

## 3) Продакшен-сборка и локальная проверка

```bash
npm run build
npm run preview
```

Проверка собранной версии:
- `http://localhost:4173`

## 4) Деплой без Lovable

Это стандартный Vite + React SPA, можно деплоить куда угодно:
- Nginx
- Caddy
- Netlify
- Vercel
- Cloudflare Pages
- GitHub Pages (при необходимости с `base`)

В деплой отправляется папка `dist/` после `npm run build`.

## Стек

- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn/ui


## 5) Подключение Frontend ↔ Backend (Translation)

### Backend (Flask)

Файл backend/app.py принимает слово из поля **Type a word** по маршруту `POST /api/translation` и печатает его в консоль.

Установите зависимости и запустите backend:

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install flask
python backend/app.py
```

Backend будет доступен на `http://localhost:5000`.

### Frontend

Во `vite.config.ts` добавлен proxy:
- `/api` → `http://127.0.0.1:5000`

Поэтому в React можно вызывать просто `fetch("/api/translation", ...)`.

Запуск frontend:

```bash
npm install
npm run dev
```

### Как проверить, что связь работает

1. Запустите backend в одном терминале:
   - `python backend/app.py`
2. Запустите frontend во втором терминале:
   - `npm run dev`
3. Откройте `http://localhost:8080`, перейдите в **Translation**.
4. Введите слово в поле `Type a word` и нажмите **Enter a Word**.
5. Убедитесь:
   - В браузере появился зелёный текст вида `Word "..." was received by backend`.
   - В терминале backend появилась строка:
     - `[Translation] Received word: ...`

Если backend не запущен, на frontend появится сообщение об ошибке подключения.


### Проверка отправки Name + About Me в backend

1. Откройте экран **Profile**.
2. Введите текст в поле `Enter your name` и в поле `About Me`.
3. Нажмите **Save**.
4. Проверьте backend-терминал:
   - `[Profile] Name: ...`
   - `[Profile] Bio: ...`
5. В интерфейсе увидите toast `Profile data was received by backend`.

### Сохранение между сессиями (что сейчас и что дальше)

Сейчас данные профиля сохраняются **в оперативной памяти Flask** (переменная `CURRENT_PROFILE`),
поэтому:
- пока backend-процесс запущен — данные есть;
- перезапустили `python backend/app.py` — данные сбрасываются.

Чтобы сохранять между сессиями, есть 2 варианта:

1. **Быстрый локальный вариант (без полноценной БД):**
   - хранить профиль в файле JSON на backend (`profile.json`);
   - при старте backend читать файл;
   - при Save перезаписывать файл.

2. **Нормальный production-вариант:**
   - добавить БД (SQLite/PostgreSQL);
   - создать таблицу пользователей;
   - сохранять `name`, `bio`, `updated_at` по `user_id`;
   - добавить авторизацию, чтобы профиль был привязан к конкретному пользователю.
