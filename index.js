require('dotenv').config();
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const express = require('express');
const { Telegraf } = require('telegraf');
const { Tamagotchi, PET_TYPES, GROWTH_STAGES } = require('./game');

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error('Ошибка: BOT_TOKEN не найден в .env');
  process.exit(1);
}

const WEB_APP_URL = process.env.WEB_APP_URL || 'https://tamagotchi-telegram.onrender.com';
const bot = new Telegraf(TOKEN);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PETS_FILE = path.join(__dirname, 'data', 'pets.json');
const pets = new Map();

function loadPets() {
  try {
    if (fs.existsSync(PETS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PETS_FILE, 'utf8'));
      for (const [userId, petData] of Object.entries(data)) {
        pets.set(userId, Tamagotchi.fromJSON(petData));
      }
      console.log(`Загружено питомцев: ${pets.size}`);
    }
  } catch (e) {
    console.error('Ошибка загрузки питомцев:', e);
  }
}

function savePets() {
  try {
    fs.mkdirSync(path.dirname(PETS_FILE), { recursive: true });
    const data = {};
    for (const [userId, pet] of pets.entries()) {
      data[userId] = pet.toJSON();
    }
    fs.writeFileSync(PETS_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Ошибка сохранения питомцев:', e);
  }
}

function getPet(userId) {
  if (!pets.has(userId)) {
    pets.set(userId, new Tamagotchi(userId));
  }
  return pets.get(userId);
}

// Тикаем всех питомцев каждую минуту (один источник истины)
setInterval(() => {
  for (const pet of pets.values()) {
    pet.tick();
  }
  savePets();
}, 60000);

app.get('/api/pet/:userId', (req, res) => {
  const pet = getPet(req.params.userId);
  res.json({
    name: pet.name,
    petType: pet.petType,
    emoji: pet.getEmoji(),
    stage: pet.stage,
    stageLabel: pet.getStageLabel(),
    ageDays: pet.ageDays,
    weight: pet.weight,
    hunger: pet.hunger,
    happiness: pet.happiness,
    energy: pet.energy,
    cleanliness: pet.cleanliness,
    discipline: pet.discipline,
    health: pet.health,
    isSick: pet.isSick,
    poopCount: pet.poopCount,
    isSleeping: pet.isSleeping,
    isDead: pet.isDead,
    deathReason: pet.deathReason,
    attentionNeeded: pet.attentionNeeded,
    attentionType: pet.attentionType,
    unlockedGames: pet.unlockedGames,
    gameState: pet.gameState
  });
});

app.post('/api/action/:userId', (req, res) => {
  const pet = getPet(req.params.userId);
  const { action, data } = req.body;
  let result;

  switch (action) {
    case 'feed':
      result = pet.feed();
      break;
    case 'snack':
      result = pet.snack();
      break;
    case 'play':
      result = pet.play();
      break;
    case 'sleep':
      result = pet.sleep();
      break;
    case 'wake':
      result = pet.wakeUp();
      break;
    case 'clean':
      result = pet.clean();
      break;
    case 'praise':
      result = pet.praise();
      break;
    case 'scold':
      result = pet.scold();
      break;
    case 'medicine':
      result = pet.medicine();
      break;
    case 'game_guess_start':
      result = { success: true, message: pet.startGuessGame() };
      break;
    case 'game_guess':
      result = pet.processGuess(data && data.number);
      break;
    case 'game_math_start':
      result = { success: true, message: pet.startMathGame() };
      break;
    case 'game_math':
      result = pet.processMath(data && data.answer);
      break;
    case 'event_pet':
      result = { success: true, message: pet.processEvent('pet') };
      break;
    case 'event_feed':
      result = { success: true, message: pet.processEvent('feed') };
      break;
    case 'event_play':
      result = { success: true, message: pet.processEvent('play') };
      break;
    case 'event_ignore':
      result = { success: true, message: pet.processEvent('ignore') };
      break;
    default:
      return res.status(400).json({ error: 'Unknown action' });
  }

  if (!result) {
    return res.status(400).json({ error: 'Action failed' });
  }

  res.json({ result, pet: getPetSnapshot(pet) });
  savePets();
});

function getPetSnapshot(pet) {
  return {
    name: pet.name,
    petType: pet.petType,
    emoji: pet.getEmoji(),
    stage: pet.stage,
    stageLabel: pet.getStageLabel(),
    ageDays: pet.ageDays,
    weight: pet.weight,
    hunger: pet.hunger,
    happiness: pet.happiness,
    energy: pet.energy,
    cleanliness: pet.cleanliness,
    discipline: pet.discipline,
    health: pet.health,
    isSick: pet.isSick,
    poopCount: pet.poopCount,
    isSleeping: pet.isSleeping,
    isDead: pet.isDead,
    deathReason: pet.deathReason,
    attentionNeeded: pet.attentionNeeded,
    attentionType: pet.attentionType
  };
}

app.get('/api/types', (req, res) => {
  res.json(PET_TYPES);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Telegram bot commands
bot.start((ctx) => {
  const pet = getPet(ctx.from.id);
  if (pet.name) {
    return ctx.reply(`${pet.getStatusText()}\n\nОткрой мини-апп для игры с питомцем!`);
  }
  const buttons = Object.entries(PET_TYPES).map(([key, info]) => [
    { text: `${info.emoji} ${info.name}`, callback_data: `choose_pet_${key}` }
  ]);
  ctx.reply('Добро пожаловать в Тамагочи Mini App! 🐾\n\nВыбери питомца:', {
    reply_markup: { inline_keyboard: buttons }
  });
});

bot.action(/choose_pet_(.+)/, (ctx) => {
  const type = ctx.match[1];
  const pet = getPet(ctx.from.id);
  pet.petType = type;
  pet.typeInfo = PET_TYPES[type] || PET_TYPES.DOG;
  ctx.editMessageText(`Теперь придумай имя для своего ${pet.typeInfo.emoji} ${pet.typeInfo.name}:`);
  ctx.answerCbQuery();
});

bot.on('message', (ctx) => {
  const pet = getPet(ctx.from.id);
  if (!pet.name && ctx.message.text && !ctx.message.text.startsWith('/')) {
    pet.name = ctx.message.text.trim();
    return ctx.reply(
      `Питомец ${pet.getEmoji()} ${pet.name} создан!\n\nОткрой мини-апп, чтобы играть с ним!`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: '🎮 Играть с питомцем', web_app: { url: `${WEB_APP_URL}?user=${ctx.from.id}` } }]]
        }
      }
    );
  }
  if (pet.name) {
    return ctx.reply(`${pet.getStatusText()}\n\nОткрой мини-апп для игры!`);
  }
});

bot.launch().then(() => {
  loadPets();
  console.log('Бот запущен!');
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

process.once('SIGINT', () => {
  savePets();
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  savePets();
  bot.stop('SIGTERM');
});
