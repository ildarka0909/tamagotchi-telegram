const STATES = {
  IDLE: 'idle',
  FEEDING: 'feeding',
  PLAYING: 'playing',
  SLEEPING: 'sleeping',
  CLEANING: 'cleaning',
  DEAD: 'dead'
};

const PET_TYPES = {
  DOG: { emoji: '🐶', name: 'Собака' },
  CAT: { emoji: '🐱', name: 'Кошка' },
  DRAGON: { emoji: '🐉', name: 'Дракон' },
  ROBOT: { emoji: '🤖', name: 'Робот' }
};

class Tamagotchi {
  constructor(userId, petType = 'DOG') {
    this.userId = userId;
    this.petType = petType;
    this.typeInfo = PET_TYPES[petType] || PET_TYPES.DOG;
    this.name = null;
    this.age = 0;
    this.hunger = 50;
    this.happiness = 50;
    this.energy = 100;
    this.cleanliness = 100;
    this.state = STATES.IDLE;
    this.createdAt = Date.now();
    this.lastTick = Date.now();
    this.isDead = false;
    this.deathReason = null;
  }

  tick() {
    if (this.isDead) return;

    const now = Date.now();
    const deltaMinutes = (now - this.lastTick) / 60000;
    this.lastTick = now;

    if (deltaMinutes <= 0) return;

    const decay = deltaMinutes * 0.5;

    this.hunger = Math.min(100, Math.max(0, this.hunger + decay));
    this.happiness = Math.max(0, Math.min(100, this.happiness - decay * 0.8));
    this.cleanliness = Math.max(0, Math.min(100, this.cleanliness - decay * 0.6));

    if (this.state !== STATES.SLEEPING) {
      this.energy = Math.max(0, Math.min(100, this.energy - decay * 0.7));
    } else {
      this.energy = Math.min(100, this.energy + decay);
    }

    this.age = Math.floor((now - this.createdAt) / 86400000);

    this.checkDeath();
  }

  checkDeath() {
    if (this.hunger >= 100 || this.happiness <= 0 || this.cleanliness <= 0 || this.energy <= 0) {
      this.isDead = true;
      this.state = STATES.DEAD;
      if (this.hunger >= 100) this.deathReason = 'голода';
      else if (this.happiness <= 0) this.deathReason = 'скуки';
      else if (this.cleanliness <= 0) this.deathReason = 'грязи';
      else this.deathReason = 'истощения';
    }
  }

  feed() {
    if (this.isDead) return false;
    this.hunger = Math.max(0, this.hunger - 30);
    this.happiness = Math.min(100, this.happiness + 5);
    this.cleanliness = Math.max(0, this.cleanliness - 5);
    this.state = STATES.FEEDING;
    this.tick();
    return true;
  }

  play() {
    if (this.isDead) return false;
    if (this.energy < 20) return false;
    this.happiness = Math.min(100, this.happiness + 25);
    this.hunger = Math.min(100, this.hunger + 15);
    this.energy = Math.max(0, this.energy - 20);
    this.cleanliness = Math.max(0, this.cleanliness - 10);
    this.state = STATES.PLAYING;
    this.tick();
    return true;
  }

  sleep() {
    if (this.isDead) return false;
    this.state = STATES.SLEEPING;
    this.energy = Math.min(100, this.energy + 40);
    this.hunger = Math.min(100, this.hunger + 10);
    this.tick();
    return true;
  }

  clean() {
    if (this.isDead) return false;
    this.cleanliness = Math.min(100, this.cleanliness + 40);
    this.happiness = Math.max(0, this.happiness - 10);
    this.state = STATES.CLEANING;
    this.tick();
    return true;
  }

  wakeUp() {
    if (this.state === STATES.SLEEPING) {
      this.state = STATES.IDLE;
    }
  }

  getStatusBar(value, label) {
    const filled = Math.round(value / 10);
    const empty = 10 - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `${label}: ${bar} ${Math.round(value)}%`;
  }

  getStatus() {
    if (this.isDead) {
      return `☠️ Ваш питомец ${this.typeInfo.emoji} ${this.name || 'Безымянный'} умер от ${this.deathReason}.`;
    }

    let mood = 'счастлив';
    if (this.happiness < 30) mood = 'грустен';
    else if (this.happiness < 60) mood = 'нормально';

    return [
      `${this.typeInfo.emoji} ${this.typeInfo.name} ${this.name || 'Безымянный'}`,
      `Возраст: ${this.age} дн.`,
      this.getStatusBar(this.hunger, '🍗 Голод'),
      this.getStatusBar(this.happiness, '😊 Радость'),
      this.getStatusBar(this.energy, '🔋 Энергия'),
      this.getStatusBar(this.cleanliness, '🧼 Чистота'),
      `Настроение: ${mood}`,
      `Состояние: ${this.getStateLabel()}`
    ].join('\n');
  }

  getStateLabel() {
    switch (this.state) {
      case STATES.IDLE: return 'бездействует';
      case STATES.FEEDING: return 'ест';
      case STATES.PLAYING: return 'играет';
      case STATES.SLEEPING: return 'спит';
      case STATES.CLEANING: return 'моется';
      case STATES.DEAD: return 'умер';
      default: return 'бездействует';
    }
  }

  getKeyboard() {
    const rows = [];
    if (this.isDead) {
      rows.push([{ text: '🔄 Завести нового питомца', callback_data: 'new_pet' }]);
      return rows;
    }

    rows.push([
      { text: '🍗 Кормить', callback_data: 'feed' },
      { text: '🎮 Играть', callback_data: 'play' }
    ]);
    rows.push([
      { text: '💤 Спать', callback_data: 'sleep' },
      { text: '🛁 Купать', callback_data: 'clean' }
    ]);
    rows.push([{ text: '📊 Статус', callback_data: 'status' }]);
    return rows;
  }
}

module.exports = { Tamagotchi, STATES, PET_TYPES };
