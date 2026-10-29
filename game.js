const PET_TYPES = {
  DOG: { emoji: '🐶', name: 'Собака', evolutions: ['🥚', '🐣', '🐕', '🐕‍🦺', '🐺'] },
  CAT: { emoji: '🐱', name: 'Кошка', evolutions: ['🥚', '🐣', '🐱', '🐈', '🐯'] },
  DRAGON: { emoji: '🐉', name: 'Дракон', evolutions: ['🥚', '🐲', '🐉', '🐲🔥', '🐉👑'] },
  ROBOT: { emoji: '🤖', name: 'Робот', evolutions: ['🔋', '🤖-1', '🤖', '🦾', '🤖Ω'] }
};

const GROWTH_STAGES = {
  EGG: 'egg',
  BABY: 'baby',
  CHILD: 'child',
  TEEN: 'teen',
  ADULT: 'adult',
  SENIOR: 'senior'
};

const STAGE_AGES = {
  [GROWTH_STAGES.EGG]: 0,
  [GROWTH_STAGES.BABY]: 1,
  [GROWTH_STAGES.CHILD]: 3,
  [GROWTH_STAGES.TEEN]: 7,
  [GROWTH_STAGES.ADULT]: 14,
  [GROWTH_STAGES.SENIOR]: 30
};

class Tamagotchi {
  constructor(userId, petType = 'DOG') {
    this.userId = userId;
    this.petType = petType;
    this.typeInfo = PET_TYPES[petType] || PET_TYPES.DOG;
    this.name = null;

    this.stage = GROWTH_STAGES.EGG;
    this.ageDays = 0;
    this.ageMinutes = 0;

    this.hunger = 0;
    this.happiness = 100;
    this.discipline = 50;
    this.weight = 5;
    this.energy = 100;
    this.cleanliness = 100;
    this.health = 100;

    this.poopCount = 0;
    this.isSick = false;
    this.sickSince = null;
    this.isSleeping = false;
    this.isDead = false;
    this.deathReason = null;

    this.createdAt = Date.now();
    this.lastTick = Date.now();
    this.lastPoopCheck = Date.now();
    this.lastCallCheck = Date.now();
    this.attentionNeeded = false;
    this.attentionType = null;
    this.callTimeout = null;

    this.totalFed = 0;
    this.totalPlayed = 0;
    this.totalCleaned = 0;
    this.totalScolded = 0;

    this.unlockedGames = ['guess'];
    this.achievements = [];
  }

  getEmoji() {
    const stageIndex = Object.values(GROWTH_STAGES).indexOf(this.stage);
    return this.typeInfo.evolutions[stageIndex] || this.typeInfo.emoji;
  }

  getStageLabel() {
    const labels = {
      [GROWTH_STAGES.EGG]: 'Яйцо',
      [GROWTH_STAGES.BABY]: 'Младенец',
      [GROWTH_STAGES.CHILD]: 'Ребёнок',
      [GROWTH_STAGES.TEEN]: 'Подросток',
      [GROWTH_STAGES.ADULT]: 'Взрослый',
      [GROWTH_STAGES.SENIOR]: 'Пожилой'
    };
    return labels[this.stage] || this.stage;
  }

  tick() {
    if (this.isDead) return;

    const now = Date.now();
    const deltaMinutes = (now - this.lastTick) / 60000;
    this.lastTick = now;
    this.ageMinutes += deltaMinutes;
    this.ageDays = Math.floor(this.ageMinutes / 1440);

    if (deltaMinutes <= 0) return;

    this.updateStage();

    if (!this.isSleeping) {
      this.hunger = Math.min(100, this.hunger + deltaMinutes * 0.8);
      this.happiness = Math.max(0, this.happiness - deltaMinutes * 0.6);
      this.energy = Math.max(0, this.energy - deltaMinutes * 0.7);
      this.cleanliness = Math.max(0, this.cleanliness - deltaMinutes * 0.4);
    } else {
      this.energy = Math.min(100, this.energy + deltaMinutes * 1.5);
      this.hunger = Math.min(100, this.hunger + deltaMinutes * 0.3);
    }

    this.weight = Math.max(1, this.weight + (this.hunger > 70 ? deltaMinutes * 0.05 : 0));
    if (this.weight > 20 && this.happiness < 30) {
      this.happiness = Math.max(0, this.happiness - deltaMinutes * 0.2);
    }

    this.checkPoop(deltaMinutes);
    this.checkSickness();
    this.checkAttention(deltaMinutes);
    this.checkDeath();
  }

  updateStage() {
    if (this.stage === GROWTH_STAGES.EGG && this.ageDays >= 1) {
      this.stage = GROWTH_STAGES.BABY;
      this.attentionNeeded = true;
      this.attentionType = 'hatched';
    } else if (this.stage === GROWTH_STAGES.BABY && this.ageDays >= STAGE_AGES[GROWTH_STAGES.CHILD]) {
      this.stage = GROWTH_STAGES.CHILD;
      this.unlockedGames.push('reaction');
    } else if (this.stage === GROWTH_STAGES.CHILD && this.ageDays >= STAGE_AGES[GROWTH_STAGES.TEEN]) {
      this.stage = GROWTH_STAGES.TEEN;
      this.unlockedGames.push('math');
    } else if (this.stage === GROWTH_STAGES.TEEN && this.ageDays >= STAGE_AGES[GROWTH_STAGES.ADULT]) {
      this.stage = GROWTH_STAGES.ADULT;
    } else if (this.stage === GROWTH_STAGES.ADULT && this.ageDays >= STAGE_AGES[GROWTH_STAGES.SENIOR]) {
      this.stage = GROWTH_STAGES.SENIOR;
    }
  }

  checkPoop(deltaMinutes) {
    const now = Date.now();
    const sinceLastPoop = (now - this.lastPoopCheck) / 60000;
    if (sinceLastPoop > 120 && Math.random() < 0.15) {
      this.poopCount++;
      this.cleanliness = Math.max(0, this.cleanliness - 10);
      this.attentionNeeded = true;
      this.attentionType = 'poop';
      this.lastPoopCheck = now;
    }
  }

  checkSickness() {
    if (this.cleanliness < 20 || this.hunger > 90) {
      if (!this.isSick && Math.random() < 0.05) {
        this.isSick = true;
        this.sickSince = Date.now();
        this.attentionNeeded = true;
        this.attentionType = 'sick';
      }
    } else if (this.isSick && this.cleanliness > 60 && this.hunger < 50) {
      this.isSick = false;
      this.sickSince = null;
    }
  }

  checkAttention(deltaMinutes) {
    if (this.hunger > 80 || this.happiness < 20 || this.poopCount > 0 || this.isSick) {
      if (!this.attentionNeeded) {
        this.attentionNeeded = true;
        if (this.poopCount > 0) this.attentionType = 'poop';
        else if (this.isSick) this.attentionType = 'sick';
        else if (this.hunger > 80) this.attentionType = 'hungry';
        else this.attentionType = 'sad';
      }
    }
  }

  checkDeath() {
    if (this.hunger >= 100 || this.happiness <= 0 || this.health <= 0 || (this.isSick && this.ageMinutes > 60 && this.hunger > 80)) {
      this.isDead = true;
      if (this.hunger >= 100) this.deathReason = 'голода';
      else if (this.happiness <= 0) this.deathReason = 'скуки и одиночества';
      else if (this.health <= 0) this.deathReason = 'болезни';
      else this.deathReason = 'истощения';
    }
  }

  feed() {
    if (this.isDead) return { success: false, message: 'Питомец уже не вернуть...' };
    if (this.isSleeping) return { success: false, message: 'Питомец спит, не буди его!' };

    this.hunger = Math.max(0, this.hunger - 25);
    this.happiness = Math.min(100, this.happiness + 5);
    this.weight = Math.min(30, this.weight + 0.5);
    this.totalFed++;
    this.attentionNeeded = false;
    this.tick();

    if (this.weight > 18) {
      return { success: true, message: `🍗 ${this.name} поел. Но он начинает полнеть...` };
    }
    return { success: true, message: `🍗 ${this.name} с аппетитом поел!` };
  }

  snack() {
    if (this.isDead) return { success: false, message: 'Питомец уже не вернуть...' };
    if (this.isSleeping) return { success: false, message: 'Питомец спит!' };

    this.hunger = Math.max(0, this.hunger - 10);
    this.happiness = Math.min(100, this.happiness + 10);
    this.weight = Math.min(30, this.weight + 1);
    this.tick();

    return { success: true, message: `🍬 ${this.name}ел лакомство! Вес +1` };
  }

  play() {
    if (this.isDead) return { success: false, message: 'Питомец уже не вернуть...' };
    if (this.isSleeping) return { success: false, message: 'Питомец спит!' };
    if (this.energy < 15) return { success: false, message: `💤 ${this.name} слишком устал, чтобы играть.` };

    this.happiness = Math.min(100, this.happiness + 20);
    this.hunger = Math.min(100, this.hunger + 10);
    this.energy = Math.max(0, this.energy - 20);
    this.cleanliness = Math.max(0, this.cleanliness - 5);
    this.totalPlayed++;
    this.attentionNeeded = false;
    this.tick();

    return { success: true, message: `🎮 ${this.name} радостно играет с тобой!` };
  }

  sleep() {
    if (this.isDead) return { success: false, message: 'Питомец уже не вернуть...' };
    if (this.isSleeping) return { success: false, message: 'Питомец уже спит.' };

    this.isSleeping = true;
    this.energy = Math.min(100, this.energy + 40);
    this.tick();

    return { success: true, message: `💤 ${this.name} засыпает...` };
  }

  wakeUp() {
    if (!this.isSleeping) return { success: false, message: 'Питомец и так не спит.' };

    this.isSleeping = false;
    this.tick();

    return { success: true, message: `☀️ ${this.name} проснулся!` };
  }

  clean() {
    if (this.isDead) return { success: false, message: 'Питомец уже не вернуть...' };

    this.poopCount = 0;
    this.cleanliness = Math.min(100, this.cleanliness + 40);
    this.happiness = Math.max(0, this.happiness - 5);
    this.totalCleaned++;
    this.attentionNeeded = false;
    this.attentionType = null;
    this.tick();

    return { success: true, message: `🛁 ${this.name} опять чистенький и пахнет свежестью!` };
  }

  scold() {
    if (this.isDead) return { success: false, message: 'Питомец уже не вернуть...' };
    if (this.isSleeping) return { success: false, message: 'Нельзя ругать спящего питомца!' };

    this.discipline = Math.min(100, this.discipline + 10);
    this.happiness = Math.max(0, this.happiness - 15);
    this.totalScolded++;
    this.attentionNeeded = false;
    this.tick();

    if (this.discipline > 70) {
      return { success: true, message: `😤 ${this.name} понял, что был неправ.` };
    }
    return { success: true, message: `👋 Ты похлопал по лапке ${this.name}. Он смотрит на тебя обидно...` };
  }

  praise() {
    if (this.isDead) return { success: false, message: 'Питомец уже не вернуть...' };

    this.happiness = Math.min(100, this.happiness + 15);
    this.discipline = Math.max(0, this.discipline - 5);
    this.tick();

    return { success: true, message: `👏 ${this.name} радостно виляет хвостом от похвалы!` };
  }

  medicine() {
    if (this.isDead) return { success: false, message: 'Питомец уже не вернуть...' };
    if (!this.isSick) return { success: false, message: 'Питомец здоров, лекарство не нужно.' };

    this.isSick = false;
    this.sickSince = null;
    this.health = Math.min(100, this.health + 30);
    this.attentionNeeded = false;
    this.attentionType = null;
    this.tick();

    return { success: true, message: `💊 ${this.name} принял лекарство и чувствует себя лучше!` };
  }

  getStatusText() {
    if (this.isDead) {
      return [
        `☠️ ${this.typeInfo.emoji} ${this.name || 'Питомец'} умер от ${this.deathReason}.`,
        `Он прожил ${this.ageDays} дней.`,
        `Всего кормлений: ${this.totalFed}`,
        `Всего игр: ${this.totalPlayed}`,
        `Всего уборок: ${this.totalCleaned}`,
        `Всего выговоров: ${this.totalScolded}`
      ].join('\n');
    }

    const bar = (value) => {
      const filled = Math.round(value / 10);
      return '█'.repeat(filled) + '░'.repeat(10 - filled);
    };

    let mood = 'счастлив';
    if (this.happiness < 25) mood = 'грустит и плачет';
    else if (this.happiness < 50) mood = 'грустен';
    else if (this.happiness < 75) mood = 'нормально';
    else mood = 'радостно виляет хвостом';

    let sickLine = this.isSick ? '\n🤒 Болеет! Нужно лекарство.' : '';
    let poopLine = this.poopCount > 0 ? `\n💩 Насрало ${this.poopCount} раз(а). Нужно убрать.` : '';
    let sleepLine = this.isSleeping ? '\n💤 Спит.' : '';
    let attentionLine = this.attentionNeeded ? `\n⚠️ Требует внимания (${this.attentionType})` : '';

    return [
      `${this.getEmoji()} ${this.typeInfo.name} ${this.name || 'Безымянный'}`,
      `Этап: ${this.getStageLabel()} | Возраст: ${this.ageDays} дн.`,
      `Вес: ${this.weight.toFixed(1)} кг`,
      `🍗 Голод: ${Math.round(this.hunger)}% ${bar(this.hunger)}`,
      `😊 Радость: ${Math.round(this.happiness)}% ${bar(this.happiness)}`,
      `🔋 Энергия: ${Math.round(this.energy)}% ${bar(this.energy)}`,
      `🧼 Чистота: ${Math.round(this.cleanliness)}% ${bar(this.cleanliness)}`,
      `🛡 Discipline: ${Math.round(this.discipline)}% ${bar(this.discipline)}`,
      `❤️ Здоровье: ${Math.round(this.health)}%`,
      `Настроение: ${mood}${sickLine}${poopLine}${sleepLine}${attentionLine}`
    ].join('\n');
  }

  getMainKeyboard() {
    const rows = [];

    if (this.isDead) {
      rows.push([{ text: '🔄 Завести нового питомца', callback_data: 'new_pet' }]);
      return rows;
    }

    if (this.isSleeping) {
      rows.push([{ text: '☀️ Разбудить', callback_data: 'wake' }]);
      rows.push([{ text: '📊 Статус', callback_data: 'status' }]);
      return rows;
    }

    rows.push([
      { text: '🍗 Кормить', callback_data: 'feed' },
      { text: '🍬 Лакомство', callback_data: 'snack' }
    ]);
    rows.push([
      { text: '🎮 Играть', callback_data: 'play_menu' },
      { text: '💤 Спать', callback_data: 'sleep' }
    ]);
    rows.push([
      { text: '🛁 Убрать', callback_data: 'clean' },
      { text: '👏 Похвалить', callback_data: 'praise' }
    ]);
    rows.push([
      { text: '👋 Ругать', callback_data: 'scold' },
      { text: '💊 Лечить', callback_data: 'medicine' }
    ]);
    rows.push([{ text: '📊 Статус', callback_data: 'status' }]);

    return rows;
  }

  getGamesKeyboard() {
    const rows = [];
    if (this.isDead || this.isSleeping) return rows;

    if (this.unlockedGames.includes('guess')) {
      rows.push([{ text: '🔢 Угадай число', callback_data: 'game_guess' }]);
    }
    if (this.unlockedGames.includes('reaction')) {
      rows.push([{ text: '⚡ Реакция', callback_data: 'game_reaction' }]);
    }
    if (this.unlockedGames.includes('math')) {
      rows.push([{ text: '🧮 Примеры', callback_data: 'game_math' }]);
    }
    rows.push([{ text: '⬅ Назад', callback_data: 'main' }]);
    return rows;
  }

  startGuessGame() {
    this.gameState = {
      type: 'guess',
      target: Math.floor(Math.random() * 10) + 1,
      attempts: 0
    };
    return `🔢 Я загадал число от 1 до 10. Угадай!`;
  }

  processGuess(num) {
    if (!this.gameState || this.gameState.type !== 'guess') return null;

    this.gameState.attempts++;
    if (num === this.gameState.target) {
      const msg = `✅ Правильно! ${this.name} угадал за ${this.gameState.attempts} попыток!`;
      this.happiness = Math.min(100, this.happiness + 15);
      this.energy = Math.max(0, this.energy - 5);
      this.gameState = null;
      this.tick();
      return { success: true, message: msg };
    } else if (this.gameState.attempts >= 3) {
      const msg = `❌ Попытки закончились. Я загадал ${this.gameState.target}.`;
      this.happiness = Math.max(0, this.happiness - 5);
      this.gameState = null;
      this.tick();
      return { success: false, message: msg };
    } else {
      const hint = num < this.gameState.target ? 'больше' : 'меньше';
      return { success: null, message: `❌ Нет. Загаданное число ${hint}. Попытка ${this.gameState.attempts}/3. Введи число:` };
    }
  }

  startReactionGame() {
    this.gameState = {
      type: 'reaction',
      targetTime: Math.floor(Math.random() * 3) + 2,
      startTime: Date.now()
    };
    return `⚡ Нажми на кнопку "Стоп!", как только пройдёт примерно ${this.gameState.targetTime} секунды!`;
  }

  processReaction() {
    if (!this.gameState || this.gameState.type !== 'reaction') return null;

    const elapsed = (Date.now() - this.gameState.startTime) / 1000;
    const diff = Math.abs(elapsed - this.gameState.targetTime);

    let msg;
    if (diff < 0.5) {
      msg = `🎯 Идеально! ${elapsed.toFixed(1)}с. ${this.name} в восторге!`;
      this.happiness = Math.min(100, this.happiness + 20);
    } else if (diff < 1.5) {
      msg = `⚡ Довольно точно! ${elapsed.toFixed(1)}с.`;
      this.happiness = Math.min(100, this.happiness + 10);
    } else {
      msg = `❌ Мимо. ${elapsed.toFixed(1)}с. Нужно было ${this.gameState.targetTime}с.`;
      this.happiness = Math.max(0, this.happiness - 5);
    }

    this.energy = Math.max(0, this.energy - 10);
    this.gameState = null;
    this.tick();
    return { success: true, message: msg };
  }

  startMathGame() {
    const a = Math.floor(Math.random() * 12) + 1;
    const b = Math.floor(Math.random() * 12) + 1;
    this.gameState = {
      type: 'math',
      a, b,
      answer: a + b
    };
    return `🧮 ${this.name} проверяет твою matematiку: Сколько будет ${a} + ${b}?`;
  }

  processMath(ans) {
    if (!this.gameState || this.gameState.type !== 'math') return null;

    if (parseInt(ans) === this.gameState.answer) {
      const msg = `✅ Правильно! ${this.name} гордится тобой!`;
      this.happiness = Math.min(100, this.happiness + 15);
      this.discipline = Math.min(100, this.discipline + 5);
    } else {
      const msg = `❌ Неправильно. Ответ был ${this.gameState.answer}.`;
      this.happiness = Math.max(0, this.happiness - 5);
    }

    this.energy = Math.max(0, this.energy - 5);
    this.gameState = null;
    this.tick();
    return { success: true, message: msg };
  }

  getRandomEvent() {
    if (this.isDead || this.isSleeping) return null;
    const roll = Math.random();
    if (roll < 0.05) {
      return {
        type: 'call',
        message: `📞 ${this.name} звонит тебе! Он хочет внимания. Что ты делаешь?`,
        keyboard: [
          [{ text: '🤗 Погладить', callback_data: 'event_pet' }],
          [{ text: '🍗 Покормить', callback_data: 'event_feed' }],
          [{ text: '🎮 Поиграть', callback_data: 'event_play' }],
          [{ text: '❌ Игнорировать', callback_data: 'event_ignore' }]
        ]
      };
    }
    return null;
  }

  processEvent(choice) {
    if (choice === 'pet') {
      this.happiness = Math.min(100, this.happiness + 15);
      this.attentionNeeded = false;
      this.tick();
      return `🤗 ${this.name} доволен твоим вниманием!`;
    } else if (choice === 'feed') {
      this.hunger = Math.max(0, this.hunger - 20);
      this.happiness = Math.min(100, this.happiness + 5);
      this.attentionNeeded = false;
      this.tick();
      return `🍗 ${this.name} счастлив, что его покормили!`;
    } else if (choice === 'play') {
      if (this.energy >= 15) {
        this.happiness = Math.min(100, this.happiness + 20);
        this.energy = Math.max(0, this.energy - 20);
        this.attentionNeeded = false;
        this.tick();
        return `🎮 ${this.name} в восторге от игры!`;
      } else {
        return `💤 ${this.name} слишком устал играть.`;
      }
    } else if (choice === 'ignore') {
      this.happiness = Math.max(0, this.happiness - 20);
      this.discipline = Math.max(0, this.discipline - 5);
      this.attentionNeeded = true;
      this.tick();
      return `😢 ${this.name} обиделся, что ты его проигнорировал...`;
    }
    return null;
  }

  toJSON() {
    return {
      userId: this.userId,
      petType: this.petType,
      name: this.name,
      stage: this.stage,
      ageDays: this.ageDays,
      ageMinutes: this.ageMinutes,
      hunger: this.hunger,
      happiness: this.happiness,
      discipline: this.discipline,
      weight: this.weight,
      energy: this.energy,
      cleanliness: this.cleanliness,
      health: this.health,
      poopCount: this.poopCount,
      isSick: this.isSick,
      sickSince: this.sickSince,
      isSleeping: this.isSleeping,
      isDead: this.isDead,
      deathReason: this.deathReason,
      createdAt: this.createdAt,
      lastTick: this.lastTick,
      lastPoopCheck: this.lastPoopCheck,
      attentionNeeded: this.attentionNeeded,
      attentionType: this.attentionType,
      totalFed: this.totalFed,
      totalPlayed: this.totalPlayed,
      totalCleaned: this.totalCleaned,
      totalScolded: this.totalScolded,
      unlockedGames: this.unlockedGames,
      achievements: this.achievements
    };
  }

  static fromJSON(data) {
    const pet = new Tamagotchi(data.userId, data.petType);
    pet.name = data.name;
    pet.stage = data.stage;
    pet.ageDays = data.ageDays;
    pet.ageMinutes = data.ageMinutes;
    pet.hunger = data.hunger;
    pet.happiness = data.happiness;
    pet.discipline = data.discipline;
    pet.weight = data.weight;
    pet.energy = data.energy;
    pet.cleanliness = data.cleanliness;
    pet.health = data.health;
    pet.poopCount = data.poopCount;
    pet.isSick = data.isSick;
    pet.sickSince = data.sickSince;
    pet.isSleeping = data.isSleeping;
    pet.isDead = data.isDead;
    pet.deathReason = data.deathReason;
    pet.createdAt = data.createdAt;
    pet.lastTick = Date.now();
    pet.lastPoopCheck = data.lastPoopCheck || Date.now();
    pet.attentionNeeded = data.attentionNeeded;
    pet.attentionType = data.attentionType;
    pet.totalFed = data.totalFed;
    pet.totalPlayed = data.totalPlayed;
    pet.totalCleaned = data.totalCleaned;
    pet.totalScolded = data.totalScolded;
    pet.unlockedGames = data.unlockedGames || ['guess'];
    pet.achievements = data.achievements || [];
    return pet;
  }
}

module.exports = { Tamagotchi, PET_TYPES, GROWTH_STAGES };
