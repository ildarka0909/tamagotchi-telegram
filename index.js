require('dotenv').config();
const http = require('http');
const { Telegraf, Markup } = require('telegraf');
const { Tamagotchi, PET_TYPES } = require('./game');

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error('Ошибка: BOT_TOKEN не найден в .env');
  process.exit(1);
}

const bot = new Telegraf(TOKEN);
const pets = new Map();

function getPet(userId) {
  if (!pets.has(userId)) {
    pets.set(userId, new Tamagotchi(userId));
  }
  return pets.get(userId);
}

bot.start((ctx) => {
  const pet = getPet(ctx.from.id);
  if (pet.name) {
    return ctx.reply(`Вы уже имеете питомца ${pet.typeInfo.emoji} ${pet.name}!\n\n${pet.getStatus()}`, Markup.inlineKeyboard(pet.getKeyboard()));
  }

  const buttons = Object.entries(PET_TYPES).map(([key, info]) => [
    Markup.button.callback(`${info.emoji} ${info.name}`, `choose_pet_${key}`)
  ]);

  ctx.reply('Привет! Выбери своего питомца:', Markup.inlineKeyboard(buttons));
});

bot.action(/choose_pet_(.+)/, (ctx) => {
  const type = ctx.match[1];
  const pet = getPet(ctx.from.id);
  pet.petType = type;
  pet.typeInfo = PET_TYPES[type] || PET_TYPES.DOG;

  ctx.editMessageText(`Отлично! Теперь придумай имя для своего ${pet.typeInfo.emoji} ${pet.typeInfo.name}:`);
  ctx.answerCbQuery();
});

bot.on('text', (ctx) => {
  const pet = getPet(ctx.from.id);
  if (!pet.name && ctx.message.text && !ctx.message.text.startsWith('/')) {
    pet.name = ctx.message.text.trim();
    return ctx.reply(
      `Питомец ${pet.typeInfo.emoji} ${pet.name} создан!\n\n${pet.getStatus()}`,
      Markup.inlineKeyboard(pet.getKeyboard())
    );
  }

  if (pet.name) {
    return ctx.reply(
      `${pet.getStatus()}\n\nИспользуй кнопки ниже для ухода за питомцем:`,
      Markup.inlineKeyboard(pet.getKeyboard())
    );
  }
});

bot.action('feed', (ctx) => {
  const pet = getPet(ctx.from.id);
  const fed = pet.feed();
  if (!fed && pet.isDead) {
    return ctx.editMessageText(`${pet.getStatus()}`, Markup.inlineKeyboard(pet.getKeyboard()));
  }
  ctx.editMessageText(
    `🍗 ${pet.typeInfo.emoji} ${pet.name} поел!\n\n${pet.getStatus()}`,
    Markup.inlineKeyboard(pet.getKeyboard())
  );
  ctx.answerCbQuery();
});

bot.action('play', (ctx) => {
  const pet = getPet(ctx.from.id);
  const played = pet.play();
  if (!played) {
    if (pet.isDead) {
      return ctx.editMessageText(`${pet.getStatus()}`, Markup.inlineKeyboard(pet.getKeyboard()));
    }
    return ctx.answerCbQuery('Слишком устал, дай поспать!');
  }
  ctx.editMessageText(
    `🎮 ${pet.typeInfo.emoji} ${pet.name} поиграл!\n\n${pet.getStatus()}`,
    Markup.inlineKeyboard(pet.getKeyboard())
  );
  ctx.answerCbQuery();
});

bot.action('sleep', (ctx) => {
  const pet = getPet(ctx.from.id);
  pet.sleep();
  ctx.editMessageText(
    `💤 ${pet.typeInfo.emoji} ${pet.name} спит...\n\n${pet.getStatus()}`,
    Markup.inlineKeyboard(pet.getKeyboard())
  );
  ctx.answerCbQuery();
});

bot.action('clean', (ctx) => {
  const pet = getPet(ctx.from.id);
  pet.clean();
  ctx.editMessageText(
    `🛁 ${pet.typeInfo.emoji} ${pet.name} выкупался!\n\n${pet.getStatus()}`,
    Markup.inlineKeyboard(pet.getKeyboard())
  );
  ctx.answerCbQuery();
});

bot.action('status', (ctx) => {
  const pet = getPet(ctx.from.id);
  ctx.editMessageText(
    `${pet.getStatus()}\n\nИспользуй кнопки ниже для ухода за питомцем:`,
    Markup.inlineKeyboard(pet.getKeyboard())
  );
  ctx.answerCbQuery();
});

bot.action('new_pet', (ctx) => {
  pets.delete(ctx.from.id);
  const pet = getPet(ctx.from.id);
  const buttons = Object.entries(PET_TYPES).map(([key, info]) => [
    Markup.button.callback(`${info.emoji} ${info.name}`, `choose_pet_${key}`)
  ]);
  ctx.editMessageText('Выбери нового питомца:', Markup.inlineKeyboard(buttons));
  ctx.answerCbQuery();
});

setInterval(() => {
  for (const pet of pets.values()) {
    pet.tick();
  }
}, 60000);

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
