const t = (key) => {
  const map = {
    sleep: '💤 Спать',
    wake: '☀️ Разбудить'
  };
  return map[key] || key;
};

let currentUserId = null;
let petData = null;
let currentGameType = null;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let petX = 195;
let petY = 150;
let petVX = 0;
let petVY = 0;
let petAngle = 0;
let petScale = 1;
let petFrame = 0;
let petState = 'idle';
let petStateTimer = 0;
let blinkTimer = 0;
let blinkState = 0;

function init() {
  const tg = window.Telegram.WebApp;
  tg.ready();
  tg.expand();
  const initData = tg.initDataUnsafe;
  currentUserId = initData?.user?.id || Date.now();

  fetchPet();
  setInterval(fetchPet, 10000);
  gameLoop();
}

async function fetchPet() {
  try {
    const res = await fetch(`/api/pet/${currentUserId}`);
    petData = await res.json();
    renderUI();
    updatePetAnimation();
  } catch (e) {
    console.error('Ошибка загрузки питомца:', e);
  }
}

function renderUI() {
  if (!petData) return;

  document.getElementById('petName').textContent = `${petData.emoji} ${petData.name || 'Питомец'}`;
  document.getElementById('petStage').textContent = `${petData.stageLabel} | Возраст: ${petData.ageDays} дн. | Вес: ${petData.weight.toFixed(1)} кг`;

  const bars = [
    { id: 'fillHunger', val: petData.hunger, label: 'valHunger' },
    { id: 'fillHappiness', val: petData.happiness, label: 'valHappiness' },
    { id: 'fillEnergy', val: petData.energy, label: 'valEnergy' },
    { id: 'fillCleanliness', val: petData.cleanliness, label: 'valCleanliness' },
    { id: 'fillDiscipline', val: petData.discipline, label: 'valDiscipline' },
    { id: 'fillHealth', val: petData.health, label: 'valHealth' }
  ];

  bars.forEach(b => {
    const fill = document.getElementById(b.id);
    const val = document.getElementById(b.label);
    fill.style.width = `${Math.round(b.val)}%`;
    fill.className = 'stat-fill';
    if (b.id === 'fillHunger' && b.val > 70) fill.classList.add('critical');
    else if (b.id === 'fillHunger' && b.val > 40) fill.classList.add('warning');
    if (b.id !== 'fillHunger' && b.val < 30) fill.classList.add('critical');
    else if (b.id !== 'fillHunger' && b.val < 60) fill.classList.add('warning');
    val.textContent = `${Math.round(b.val)}%`;
  });

  const msgDiv = document.getElementById('messages');
  if (petData.attentionNeeded) {
    msgDiv.style.display = 'block';
    let msg = '';
    if (petData.attentionType === 'hungry') msg = '🍗 Голоден!';
    else if (petData.attentionType === 'sad') msg = '😢 Грустит!';
    else if (petData.attentionType === 'poop') msg = '💩 Нужно убрать!';
    else if (petData.attentionType === 'sick') msg = '🤒 Болеет!';
    msgDiv.textContent = msg;
  } else {
    msgDiv.style.display = 'none';
  }

  const sleepBtn = document.querySelector('button[onclick="toggleSleep()"]');
  if (sleepBtn) {
    sleepBtn.textContent = petData.isSleeping ? '☀️ Разбудить' : '💤 Спать';
  }

  const gamesPanel = document.getElementById('gamesPanel');
  if (petData.unlockedGames && petData.unlockedGames.length > 0) {
    gamesPanel.style.display = 'block';
  }
}

async function doAction(action) {
  if (!petData || petData.isDead) return;

  try {
    const res = await fetch(`/api/action/${currentUserId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    petData = data.pet;
    showMessage(data.result?.message || 'Готово');
    renderUI();
  } catch (e) {
    console.error(e);
  }
}

function toggleSleep() {
  if (!petData) return;
  doAction(petData.isSleeping ? 'wake' : 'sleep');
}

function showMessage(text) {
  const div = document.getElementById('messages');
  div.textContent = text;
  div.style.display = 'block';
  setTimeout(() => { div.style.display = 'none'; }, 3000);
}

function startGuess() {
  if (!petData || petData.isDead) return;
  currentGameType = 'guess';
  document.getElementById('inputPanel').style.display = 'flex';
  document.getElementById('gameInput').value = '';
  document.getElementById('gameInput').focus();
  fetch(`/api/action/${currentUserId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'game_guess_start' })
  }).then(r => r.json()).then(d => {
    showMessage(d.result.message);
  }).catch(e => {
    console.error(e);
    closeInput();
  });
}

function startMath() {
  if (!petData || petData.isDead) return;
  currentGameType = 'math';
  document.getElementById('inputPanel').style.display = 'flex';
  document.getElementById('gameInput').value = '';
  document.getElementById('gameInput').focus();
  fetch(`/api/action/${currentUserId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'game_math_start' })
  }).then(r => r.json()).then(d => {
    showMessage(d.result.message);
  }).catch(e => {
    console.error(e);
    closeInput();
  });
}

function submitGameInput() {
  const input = document.getElementById('gameInput');
  const val = input.value;
  if (!val) return;

  const action = currentGameType === 'guess' ? 'game_guess' : 'game_math';
  const data = currentGameType === 'guess' ? { number: parseInt(val) } : { answer: parseInt(val) };

  fetch(`/api/action/${currentUserId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data })
  }).then(r => r.json()).then(d => {
    petData = d.pet;
    if (d.result.success === null) {
      // Подсказка в угадайке, продолжаем игру
      showMessage(d.result.message);
    } else {
      showMessage(d.result.message);
      renderUI();
      closeInput();
    }
  }).catch(e => {
    console.error(e);
    closeInput();
  });
}

function closeInput() {
  document.getElementById('inputPanel').style.display = 'none';
  currentGameType = null;
}

function closeGames() {
  document.getElementById('gamesPanel').style.display = 'none';
}

function updatePetAnimation() {
  if (!petData) return;

  if (petData.isDead) {
    petState = 'dead';
    return;
  }

  if (petData.isSleeping) {
    petState = 'sleep';
    return;
  }

  if (petData.attentionNeeded) {
    petState = 'attention';
  } else if (petData.happiness > 70) {
    petState = 'happy';
  } else if (petData.happiness < 30) {
    petState = 'sad';
  } else {
    petState = 'idle';
  }
}

function gameLoop() {
  const now = Date.now();

  // Физика питомца
  if (petState === 'idle' || petState === 'happy' || petState === 'sad' || petState === 'attention') {
    petStateTimer += 16;
    if (petStateTimer > 2000) {
      petVX = (Math.random() - 0.5) * 2;
      petVY = (Math.random() - 0.5) * 2;
      petStateTimer = 0;
    }
    petX += petVX;
    petY += petVY;

    // Границы
    if (petX < 50 || petX > canvas.width - 50) petVX *= -1;
    if (petY < 50 || petY > canvas.height - 50) petVY *= -1;

    petAngle = Math.atan2(petVY, petVX);
    petScale = 1 + Math.sin(now / 200) * 0.05;
  } else if (petState === 'sleep') {
    petVX = 0;
    petVY = 0;
    petScale = 0.9;
    petY = canvas.height - 120;
  }

  // Анимация моргания
  blinkTimer += 16;
  if (blinkTimer > 3000 + Math.random() * 2000) {
    blinkState = 1;
    setTimeout(() => { blinkState = 0; }, 150);
    blinkTimer = 0;
  }

  // Анимация кадров
  petFrame = (petFrame + 1) % 60;

  draw();
  requestAnimationFrame(gameLoop);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Фон травы
  ctx.fillStyle = '#8bc34a';
  ctx.fillRect(0, canvas.height - 60, canvas.width, 60);

  // Солнце
  ctx.fillStyle = '#ffeb3b';
  ctx.beginPath();
  ctx.arc(canvas.width - 60, 60, 40, 0, Math.PI * 2);
  ctx.fill();

  // Облака
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(80, 100, 30, 0, Math.PI * 2);
  ctx.arc(110, 100, 35, 0, Math.PI * 2);
  ctx.arc(140, 100, 30, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(petX, petY);
  ctx.rotate(petAngle);
  ctx.scale(petScale, petScale);

  if (petData && petData.isDead) {
    drawDeadPet();
  } else if (petData && petData.isSleeping) {
    drawSleepingPet();
  } else {
    drawAlivePet();
  }

  ctx.restore();

  // Какашки
  if (petData && petData.poopCount > 0) {
    ctx.fillStyle = '#8d6e63';
    for (let i = 0; i < petData.poopCount; i++) {
      ctx.beginPath();
      ctx.arc(80 + i * 30, canvas.height - 40, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Индикатор внимания
  if (petData && petData.attentionNeeded && petState !== 'sleep') {
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath();
    ctx.arc(petX + 25, petY - 40, 8, 0, Math.PI * 2);
    ctx.fill();
    if (Math.floor(Date.now() / 500) % 2 === 0) {
      ctx.fillStyle = '#ff9800';
      ctx.beginPath();
      ctx.arc(petX + 25, petY - 40, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawAlivePet() {
  const type = petData.petType || 'DOG';
  const isDog = type === 'DOG';
  const isCat = type === 'CAT';
  const isDragon = type === 'DRAGON';
  const isRobot = type === 'ROBOT';

  const blink = blinkState === 1;

  // Тень
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 35, 20, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  if (isDog) {
    // Тело
    ctx.fillStyle = '#F4A261';
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Голова
    ctx.fillStyle = '#F4A261';
    ctx.beginPath();
    ctx.arc(-15, -12, 14, 0, Math.PI * 2);
    ctx.fill();

    // Уши
    ctx.fillStyle = '#E76F51';
    ctx.beginPath();
    ctx.ellipse(-22, -18, 6, 10, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-8, -20, 6, 10, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Глаза
    ctx.fillStyle = '#2D4059';
    if (blink) {
      ctx.fillRect(-19, -14, 4, 2);
      ctx.fillRect(-11, -14, 4, 2);
    } else {
      ctx.beginPath(); ctx.arc(-19, -14, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-11, -14, 3, 0, Math.PI * 2); ctx.fill();
    }

    // Нос
    ctx.fillStyle = '#2D4059';
    ctx.beginPath(); ctx.arc(-22, -10, 3, 0, Math.PI * 2); ctx.fill();

    // Лапы
    ctx.fillStyle = '#F4A261';
    ctx.beginPath(); ctx.arc(-8, 10, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4, 10, 5, 0, Math.PI * 2); ctx.fill();

    // Хвост
    ctx.strokeStyle = '#E76F51';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.quadraticCurveTo(20, -5, 18, -12);
    ctx.stroke();
  } else if (isCat) {
    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath(); ctx.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath(); ctx.arc(-14, -10, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFD700';
    if (blink) {
      ctx.fillRect(-17, -12, 3, 2);
      ctx.fillRect(-11, -12, 3, 2);
    } else {
      ctx.beginPath(); ctx.arc(-17, -12, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-11, -12, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#FF6B6B';
    ctx.beginPath(); ctx.arc(-19, -8, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath(); ctx.arc(-6, 8, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(2, 8, 4, 0, Math.PI * 2); ctx.fill();
  } else if (isDragon) {
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath(); ctx.ellipse(0, 0, 24, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath(); ctx.arc(-16, -12, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FF5722';
    if (blink) {
      ctx.fillRect(-19, -14, 3, 2);
      ctx.fillRect(-11, -14, 3, 2);
    } else {
      ctx.beginPath(); ctx.arc(-19, -14, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-11, -14, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#FF5722';
    ctx.beginPath(); ctx.arc(-22, -10, 2.5, 0, Math.PI * 2); ctx.fill();
    // Крылья
    ctx.fillStyle = '#2E7D32';
    ctx.beginPath();
    ctx.moveTo(10, -2);
    ctx.lineTo(22, -10);
    ctx.lineTo(16, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-6, 9, 4, 0, Math.PI * 2); ctx.fill();
    ctx.arc(2, 9, 4, 0, Math.PI * 2); ctx.fill();
  } else if (isRobot) {
    ctx.fillStyle = '#90A4AE';
    ctx.beginPath(); ctx.rect(-16, -8, 32, 18); ctx.fill();
    ctx.fillStyle = '#607D8B';
    ctx.beginPath(); ctx.rect(-18, -10, 36, 22); ctx.fill();
    ctx.fillStyle = '#FFEB3B';
    if (blink) {
      ctx.fillRect(-13, -4, 5, 4);
      ctx.fillRect(8, -4, 5, 4);
    } else {
      ctx.beginPath(); ctx.arc(-11, -2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(10, -2, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#455A64';
    ctx.beginPath(); ctx.arc(-14, -2, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#90A4AE';
    ctx.beginPath(); ctx.arc(-6, 10, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(2, 10, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FF5722';
    ctx.beginPath(); ctx.arc(-2, 2, 3, 0, Math.PI * 2); ctx.fill();
  }

  // Анимация движения лап при ходьбе
  if (petState !== 'idle' && petState !== 'sleep' && petData && !petData.isSleeping) {
    const legOffset = Math.sin(Date.now() / 150) * 3;
    ctx.strokeStyle = '#E76F51';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, 8);
    ctx.lineTo(-6 - legOffset, 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4, 8);
    ctx.lineTo(4 + legOffset, 14);
    ctx.stroke();
  }
}

function drawSleepingPet() {
  ctx.fillStyle = '#90A4AE';
  ctx.beginPath(); ctx.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2D4059';
  ctx.beginPath(); ctx.arc(-5, -5, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(2, -5, 2, 0, Math.PI * 2); ctx.fill();
  // Зzz
  ctx.fillStyle = '#4CAF50';
  ctx.font = '16px Arial';
  ctx.fillText('Z', 12, -10);
  ctx.fillText('z', 16, -5);
}

function drawDeadPet() {
  ctx.fillStyle = '#757575';
  ctx.beginPath(); ctx.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2D4059';
  ctx.beginPath(); ctx.arc(-6, -3, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(2, -3, 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2D4059';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-4, 2);
  ctx.lineTo(4, 2);
  ctx.stroke();
}

window.addEventListener('DOMContentLoaded', init);
