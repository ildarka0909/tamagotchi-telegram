require('dotenv').config();
const http = require('http');
const { Telegraf, Markup } = require('telegraf');
const { Tamagotchi, PET_TYPES, GROWTH_STAGES } = require('./game');

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error('Ошибка: BOT_TOKEN не найден в .env');
  process.exit(1);
}

const bot = new Telegraf(TOKEN);
const pets = new Map();
const userStates = new Map();

function getPet(userId) {
  if (!pets.has(userId)) {
    pets.set(userId, new Tamagotchi(userId));
  }
  return pets.get(userId);
}

function setState(userId, state, data = {}) {
  userStates.set(userId, { state, ...data });
}

function getState(userId) {
  return userStates.get(userId);
}

function clearState(userId) {
  userStates.delete(userId);
}

bot.start(async (ctx) => {
  const pet = getPet(ctx.from.id);
  if (pet.name) {
    pet.tick();
    return ctx.reply(`${pet.getStatusText()}\n\nЧто хочешь сделать?`, Markup.inlineKeyboard(pet.getMainKeyboard()));
  }

  const buttons = Object.entries(PET_TYPES).map(([key, info]) => [
    Markup.button.callback(`${info.emoji} ${info.name}`, `choose_pet_${key}`)
  ]);
  ctx.reply('Добро пожаловать в Тамагочи! 🐾\n\nВыбери своего питомца:', Markup.inlineKeyboard(buttons));
});

bot.action(/choose_pet_(.+)/, async (ctx) => {
  const type = ctx.match[1];
  const pet = getPet(ctx.from.id);
  pet.petType = type;
  pet.typeInfo = PET_TYPES[type] || PET_TYPES.DOG;

  ctx.editMessageText(`Отлично! Теперь придумай имя для своего ${pet.typeInfo.emoji} ${pet.typeInfo.name}:`);
  setState(ctx.from.id, 'waiting_name');
  ctx.answerCbQuery();
});

bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  const state = getState(ctx.from.id);
  const pet = getPet(ctx.from.id);

  if (state && state.state === 'waiting_name') {
    pet.name = text;
    pet.stage = GROWTH_STAGES.EGG;
    pet.tick();
    clearState(ctx.from.id);
    return ctx.reply(
      `Питомец ${pet.getEmoji()} ${pet.name} создан!\n\n${pet.getStatusText()}\n\nОн только что вылупился из яйца. Заботься о нём!`,
      Markup.inlineKeyboard(pet.getMainKeyboard())
    );
  }

  if (state && state.state === 'guess_game') {
    const num = parseInt(text);
    if (isNaN(num) || num < 1 || num > 10) {
      return ctx.reply('Введи число от 1 до 10:');
    }
    const result = pet.processGuess(num);
    pet.tick();
    if (result.success !== null) {
      clearState(ctx.from.id);
      return ctx.reply(`${result.message}\n\n${pet.getStatusText()}`, Markup.inlineKeyboard(pet.getMainKeyboard()));
    }
    return ctx.reply(result.message);
  }

  if (state && state.state === 'math_game') {
    const result = pet.processMath(text);
    pet.tick();
    clearState(ctx.from.id);
    return ctx.reply(`${result.message}\n\n${pet.getStatusText()}`, Markup.inlineKeyboard(pet.getMainKeyboard()));
  }

  if (pet.name) {
    pet.tick();
    return ctx.reply(`${pet.getStatusText()}\n\nИспользуй кнопки ниже для ухода за питомцем:`, Markup.inlineKeyboard(pet.getMainKeyboard()));
  }
});

bot.action('feed', async (ctx) => {
  const pet = getPet(ctx.from.id);
  pet.tick();
  const result = pet.feed();
  ctx.editMessageText(`${result.message}\n\n${pet.getStatusText()}`, Markup.inlineKeyboard(pet.getMainKeyboard()));
  ctx.answerCbQuery();
});

bot.action('snack', async (ctx) => {
  const pet = getPet(ctx.from.id);
  pet.tick();
  const result = pet.snack();
  ctx.editMessageText(`${result.message}\n\n${pet.getStatusText()}`, Markup.inlineKeyboard(pet.getMainKeyboard()));
  ctx.answerCbQuery();
});

bot.action('play_menu', async (ctx) => {
  const pet = getPet(ctx.from.id);
  pet.tick();
  ctx.editMessageText(`Выбери игру:\n\n${pet.getStatusText()}`, Markup.inlineKeyboard(pet.getGamesKeyboard()));
  ctx.answerCbQuery();
});

bot.action('game_guess', async (ctx) => {
  const pet = getPet(ctx.from.id);
  pet.tick();
  const msg = pet.startGuessGame();
  setState(ctx.from.id, 'guess_game');
  ctx.editMessageText(`${msg}\n\n${pet.getStatusText()}`, Markup.inlineKeyboard(pet.getMainKeyboard()));
  ctx.answerCbQuery();
});

bot.action('game_reaction', async (ctx) => {
  const pet = getPet(ctx.from.id);
  pet.tick();
  const msg = pet.startReactionGame();
  setState(ctx.from.id, 'reaction_game', { startTime: Date.now(), target: pet.gameState.targetTime });
  ctx.editMessageText(`${msg}\n\nНажми "Стоп!", когда пройдёт время!`, Markup.inlineKeyboard([
    [{ text: '⏹ Стоп!', callback_data: 'reaction_stop' }],
    [{ text: '⬅ Назад', callback_data: 'play_menu' }]
  ]));
  ctx.answerCbQuery();
});

bot.action('reaction_stop', async (ctx) => {
  const pet = getPet(ctx.from.id);
  const result = pet.processReaction();
  pet.tick();
  clearState(ctx.from.id);
  ctx.editMessageText(`${result.message}\n\n${pet.getStatusText()}`, Markup.inlineKeyboard(pet.getMainKeyboard()));
  ctx.answerCbQuery();
});

bot.action('game_math', async (ctx) => {
  const pet = getPet(ctx.from.id);
  pet.tick();
  const msg = pet.startMathGame();
  setState(ctx.from.id, 'math_game');
  ctx.editMessageText(`${msg}\n\nВведи ответ числом:`, Markup.inlineKeyboard(pet.getMainKeyboard()));
  ctx.answerCbQuery();
});

bot.action('sleep', async (ctx) => {
  const pet = getPet(ctx.from.id);
  pet.tick();
  const result = pet.sleep();
  ctx.editMessageText(`${result.message}\n\n${pet.getStatusText()}`, Markup.inlineKeyboard(pet.getMainKeyboard()));
  ctx.answerCbQuery();
});

bot.action('wake', async (ctx) => {
  const pet = getPet(ctx.from.id);
  pet.tick();
  const result = pet.wakeUp();
  ctx.editMessageText(`${result.message}\n\n${pet.getStatusText()}`, Markup.inlineKeyboard(pet.getMainKeyboard()));
  ctx.answerCbQuery();
});

bot.action('clean', async (ctx) => {
  const pet = getPet(ctx.from.id);
  pet.tick();
  const result = pet.clean();
  ctx.editMessageText(`${result.message}\n\n${pet.getStatusText()}`, Markup.inlineKeyboard(pet.getMainKeyboard()));
  ctx.answerCbQuery();
});

bot.action('praise', async (ctx) => {
  const pet = getPet(ctx.from.id);
  pet.tick();
  const result = pet.praise();
  ctx.editMessageText(`${result.message}\n\n${pet.getStatusText()}`, Markup.inlineKeyboard(pet.getMainKeyboard()));
  ctx.answerCbQuery();
});

bot.action('scold', async (ctx) => {
  const pet = getPet(ctx.from.id);
  pet.tick();
  const result = pet.scold();
  ctx.editMessageText(`${result.message}\n\n${pet.getStatusText()}`, Markup.inlineKeyboard(pet.getMainKeyboard()));
  ctx.answerCbQuery();
});

bot.action('medicine', async (ctx) => {
  const pet = getPet(ctx.from.id);
  pet.tick();
  const result = pet.medicine();
  ctx.editMessageText(`${result.message}\n\n${pet.getStatusText()}`, Markup.inlineKeyboard(pet.getMainKeyboard()));
  ctx.answerCbQuery();
});

bot.action('status', async (ctx) => {
  const pet = getPet(ctx.from.id);
  pet.tick();
  ctx.editMessageText(`${pet.getStatusText()}\n\nВыбери действие:`, Markup.inlineKeyboard(pet.getMainKeyboard()));
  ctx.answerCbQuery();
});

bot.action('main', async (ctx) => {
  const pet = getPet(ctx.from.id);
  pet.tick();
  ctx.editMessageText(`${pet.getStatusText()}\n\nЧто хочешь сделать?`, Markup.inlineKeyboard(pet.getMainKeyboard()));
  ctx.answerCbQuery();
});

bot.action('new_pet', async (ctx) => {
  pets.delete(ctx.from.id);
  const pet = getPet(ctx.from.id);
  const buttons = Object.entries(PET_TYPES).map(([key, info]) => [
    Markup.button.callback(`${info.emoji} ${info.name}`, `choose_pet_${key}`)
  ]);
  ctx.editMessageText('Выбери нового питомца:', Markup.inlineKeyboard(buttons));
  ctx.answerCbQuery();
});

bot.action(/event_(.+)/, async (ctx) => {
  const choice = ctx.match[1];
  const pet = getPet(ctx.from.id);
  pet.tick();
  const result = pet.processEvent(choice);
  ctx.editMessageText(`${result}\n\n${pet.getStatusText()}`, Markup.inlineKeyboard(pet.getMainKeyboard()));
  ctx.answerCbQuery();
});

setInterval(() => {
  for (const pet of pets.values()) {
    pet.tick();
  }
}, 30000);

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running');
});

server.listen(process.env.PORT || 3000, () => {
  console.log(`HTTP server listening on port ${process.env.PORT || 3000}`);
});

bot.launch().then(() => {
  console.log('Бот запущен!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
