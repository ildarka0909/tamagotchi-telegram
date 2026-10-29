# Развёртывание Telegram бота Tamagotchi на Render (бесплатно)

## 1. Залей код на GitHub
Создай репозиторий на GitHub и закинь туда файлы проекта:
- index.js
- game.js
- package.json
- .env.example
- Procfile
- render.yaml

Не заливай `.env` с токеном — его добавим в настройках Render.

## 2. Подключи репозиторий к Render
1. Зарегистрируйся на [render.com](https://render.com)
2. Нажми "New +" → "Web Service"
3. Подключи свой GitHub-аккаунт и выбери репозиторий с ботом
4. Render сам подхватит `render.yaml`

## 3. Добавь переменную окружения
В настройках сервиса (Environment Variables) добавь:
- `BOT_TOKEN` = твой токен от @BotFather

## 4. Деплой
Нажми "Create Web Service". Render соберёт и запустит бота.

## 5. Проверь
Напиши боту `/start` в Telegram.

---

## Альтернатива: Railway
1. Зарегистрируйся на [railway.app](https://railway.app)
2. Подключи GitHub-репозиторий
3. Добавь переменную `BOT_TOKEN`
4. Разверни — Railway сам определит Node.js и запустит `npm start`

---

Важно: бесплатные тарифы могут "засыпать" после бездействия. Бот будет работать, но с небольшой задержкой при первом сообщении после сна.
