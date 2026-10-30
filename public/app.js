const DEV_CODE = 'TAMAGOTCHI_DEV';

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
let clickCount = 0;
let clickTimer = null;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const PIXEL_SIZE = 6;

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

  // Секрет: клик по имени питомца
  const petName = document.getElementById('petName');
  petName.addEventListener('click', handlePetNameClick);

  fetchPet();
  setInterval(fetchPet, 10000);
  gameLoop();
}

function handlePetNameClick() {
  clickCount++;
  if (clickTimer) clearTimeout(clickTimer);
  clickTimer = setTimeout(() => { clickCount = 0; }, 1500);

  if (clickCount >= 5) {
    clickCount = 0;
    if (clickTimer) clearTimeout(clickTimer);
    openDevCodePanel();
  }
}

function openDevCodePanel() {
  document.getElementById('devCodePanel').style.display = 'flex';
  document.getElementById('devCodeInput').value = '';
  document.getElementById('devCodeInput').focus();
}

function closeDevCodePanel() {
  document.getElementById('devCodePanel').style.display = 'none';
}

function submitDevCode() {
  const input = document.getElementById('devCodeInput');
  if (input.value.trim() === DEV_CODE) {
    closeDevCodePanel();
    openDevPanel();
  } else {
    alert('Неверный код!');
    input.value = '';
    input.focus();
  }
}

function openDevPanel() {
  document.getElementById('devPanel').style.display = 'flex';
}

function closeDevPanel() {
  document.getElementById('devPanel').style.display = 'none';
}

async function devAction(action) {
  try {
    const res = await fetch(`/api/dev/${currentUserId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    petData = data.pet;
    showMessage(data.result?.message || 'Готово (dev)');
    renderUI();
    closeDevPanel();
  } catch (e) {
    console.error(e);
    alert('Ошибка разработчика: ' + e.message);
  }
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
  const petNameEl = document.getElementById('petName');
  petNameEl.onclick = null;
  petNameEl.addEventListener('click', handlePetNameClick);
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
    else if (petData.attentionType === 'hatched') msg = '🥚 Вылупился!';
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
    showMessage(d.result.message);
    renderUI();
    closeInput();
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

  if (petState === 'idle' || petState === 'happy' || petState === 'sad' || petState === 'attention') {
    petStateTimer += 16;
    if (petStateTimer > 2000) {
      petVX = (Math.random() - 0.5) * 1.5;
      petVY = (Math.random() - 0.5) * 1.5;
      petStateTimer = 0;
    }
    petX += petVX;
    petY += petVY;

    if (petX < 40 || petX > canvas.width - 40) petVX *= -1;
    if (petY < 40 || petY > canvas.height - 80) petVY *= -1;

    petAngle = Math.atan2(petVY, petVX);
    petScale = 1 + Math.sin(now / 200) * 0.04;
  } else if (petState === 'sleep') {
    petVX = 0;
    petVY = 0;
    petScale = 0.85;
    petY = canvas.height - 110;
  }

  blinkTimer += 16;
  if (blinkTimer > 3000 + Math.random() * 2000) {
    blinkState = 1;
    setTimeout(() => { blinkState = 0; }, 150);
    blinkTimer = 0;
  }

  petFrame = (petFrame + 1) % 60;

  draw();
  requestAnimationFrame(gameLoop);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Фон травы (пиксельный)
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
  } else if (petData && petData.stage === 'egg') {
    drawEgg();
  } else {
    drawPixelPet();
  }

  ctx.restore();

  // Какашки
  if (petData && petData.poopCount > 0) {
    ctx.fillStyle = '#8d6e63';
    for (let i = 0; i < petData.poopCount; i++) {
      drawPixel(80 + i * 30, canvas.height - 45, '#8d6e63', 2);
    }
  }

  // Индикатор внимания
  if (petData && petData.attentionNeeded && petState !== 'sleep') {
    ctx.fillStyle = '#ffeb3b';
    drawPixel(petX + 15, petY - 35, '#ffeb3b', 2);
    if (Math.floor(Date.now() / 500) % 2 === 0) {
      ctx.fillStyle = '#ff9800';
      drawPixel(petX + 15, petY - 35, '#ff9800', 1);
    }
  }
}

function drawPixel(x, y, color, size = PIXEL_SIZE) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
}

function drawEgg() {
  // Пиксельное яйцо
  drawPixel(0, -10, '#fff', PIXEL_SIZE);
  drawPixel(-PIXEL_SIZE, -5, '#fff', PIXEL_SIZE);
  drawPixel(PIXEL_SIZE, -5, '#fff', PIXEL_SIZE);
  drawPixel(-PIXEL_SIZE, 0, '#fff', PIXEL_SIZE);
  drawPixel(0, 0, '#fff', PIXEL_SIZE);
  drawPixel(PIXEL_SIZE, 0, '#fff', PIXEL_SIZE);
  drawPixel(-PIXEL_SIZE, 5, '#fff', PIXEL_SIZE);
  drawPixel(0, 5, '#fff', PIXEL_SIZE);
  drawPixel(PIXEL_SIZE, 5, '#fff', PIXEL_SIZE);
  drawPixel(0, 10, '#fff', PIXEL_SIZE);

  // Треснувшая скорлупа (случайно)
  if (petFrame % 40 < 20) {
    drawPixel(-PIXEL_SIZE, -10, '#e0e0e0', PIXEL_SIZE);
    drawPixel(PIXEL_SIZE, 10, '#e0e0e0', PIXEL_SIZE);
  }

  // Тень
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 20, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPixelPet() {
  const type = petData.petType || 'DOG';
  const isDog = type === 'DOG';
  const isCat = type === 'CAT';
  const isDragon = type === 'DRAGON';
  const isRobot = type === 'ROBOT';

  const blink = blinkState === 1;
  const color = isDog ? '#F4A261' : isCat ? '#C0C0C0' : isDragon ? '#4CAF50' : '#90A4AE';
  const darkColor = isDog ? '#E76F51' : isCat ? '#A0A0A0' : isDragon ? '#2E7D32' : '#607D8B';
  const eyeColor = '#2D4059';

  // Тень
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 25, 18, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  if (isDog) {
    drawPixel(-PIXEL_SIZE, -15, color, PIXEL_SIZE); // левое ухо
    drawPixel(PIXEL_SIZE, -18, color, PIXEL_SIZE); // правое ухо
    drawPixel(-PIXEL_SIZE*2, -12, darkColor, PIXEL_SIZE);
    drawPixel(PIXEL_SIZE*2, -15, darkColor, PIXEL_SIZE);

    drawPixel(-PIXEL_SIZE, -8, color, PIXEL_SIZE); // голова лево
    drawPixel(0, -8, color, PIXEL_SIZE); // голова центр
    drawPixel(PIXEL_SIZE, -8, color, PIXEL_SIZE); // голова право

    drawPixel(-PIXEL_SIZE*2, -3, color, PIXEL_SIZE); // тело лево
    drawPixel(-PIXEL_SIZE, -3, color, PIXEL_SIZE); // тело центр-лево
    drawPixel(0, -3, color, PIXEL_SIZE); // тело центр
    drawPixel(PIXEL_SIZE, -3, color, PIXEL_SIZE); // тело центр-право
    drawPixel(PIXEL_SIZE*2, -3, color, PIXEL_SIZE); // тело право

    // Глаза
    ctx.fillStyle = eyeColor;
    if (blink) {
      drawPixel(-PIXEL_SIZE, -7, '#000', 2);
      drawPixel(PIXEL_SIZE, -7, '#000', 2);
    } else {
      drawPixel(-PIXEL_SIZE, -7, eyeColor, 2);
      drawPixel(PIXEL_SIZE, -7, eyeColor, 2);
    }

    // Нос
    drawPixel(-PIXEL_SIZE*2, -5, eyeColor, 2);

    // Лапы
    drawPixel(-PIXEL_SIZE, 5, color, PIXEL_SIZE);
    drawPixel(PIXEL_SIZE, 5, color, PIXEL_SIZE);

    // Хвост
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PIXEL_SIZE*2, -3);
    ctx.lineTo(PIXEL_SIZE*3, -8);
    ctx.stroke();
  } else if (isCat) {
    drawPixel(-PIXEL_SIZE, -12, color, PIXEL_SIZE);
    drawPixel(PIXEL_SIZE, -12, color, PIXEL_SIZE);
    drawPixel(-PIXEL_SIZE*2, -8, darkColor, PIXEL_SIZE);
    drawPixel(PIXEL_SIZE*2, -8, darkColor, PIXEL_SIZE);

    drawPixel(-PIXEL_SIZE, -4, color, PIXEL_SIZE);
    drawPixel(0, -4, color, PIXEL_SIZE);
    drawPixel(PIXEL_SIZE, -4, color, PIXEL_SIZE);

    drawPixel(-PIXEL_SIZE*2, 1, color, PIXEL_SIZE);
    drawPixel(-PIXEL_SIZE, 1, color, PIXEL_SIZE);
    drawPixel(0, 1, color, PIXEL_SIZE);
    drawPixel(PIXEL_SIZE, 1, color, PIXEL_SIZE);
    drawPixel(PIXEL_SIZE*2, 1, color, PIXEL_SIZE);

    ctx.fillStyle = '#FFD700';
    if (blink) {
      drawPixel(-PIXEL_SIZE, -5, '#000', 2);
      drawPixel(PIXEL_SIZE, -5, '#000', 2);
    } else {
      drawPixel(-PIXEL_SIZE, -5, '#FFD700', 2);
      drawPixel(PIXEL_SIZE, -5, '#FFD700', 2);
    }

    drawPixel(-PIXEL_SIZE*2, -3, '#FF6B6B', 2);

    drawPixel(-PIXEL_SIZE, 6, color, PIXEL_SIZE);
    drawPixel(PIXEL_SIZE, 6, color, PIXEL_SIZE);
  } else if (isDragon) {
    drawPixel(-PIXEL_SIZE, -14, color, PIXEL_SIZE);
    drawPixel(PIXEL_SIZE, -14, color, PIXEL_SIZE);

    drawPixel(-PIXEL_SIZE*2, -9, color, PIXEL_SIZE);
    drawPixel(-PIXEL_SIZE, -9, color, PIXEL_SIZE);
    drawPixel(0, -9, color, PIXEL_SIZE);
    drawPixel(PIXEL_SIZE, -9, color, PIXEL_SIZE);
    drawPixel(PIXEL_SIZE*2, -9, color, PIXEL_SIZE);

    drawPixel(-PIXEL_SIZE*2, -3, color, PIXEL_SIZE);
    drawPixel(-PIXEL_SIZE, -3, color, PIXEL_SIZE);
    drawPixel(0, -3, color, PIXEL_SIZE);
    drawPixel(PIXEL_SIZE, -3, color, PIXEL_SIZE);
    drawPixel(PIXEL_SIZE*2, -3, color, PIXEL_SIZE);

    ctx.fillStyle = '#FF5722';
    if (blink) {
      drawPixel(-PIXEL_SIZE, -8, '#000', 2);
      drawPixel(PIXEL_SIZE, -8, '#000', 2);
    } else {
      drawPixel(-PIXEL_SIZE, -8, '#FF5722', 2);
      drawPixel(PIXEL_SIZE, -8, '#FF5722', 2);
    }

    drawPixel(-PIXEL_SIZE*2, -6, '#FF5722', 2);

    // Крылья
    ctx.fillStyle = '#2E7D32';
    drawPixel(PIXEL_SIZE*2, -5, '#2E7D32', PIXEL_SIZE);
    drawPixel(PIXEL_SIZE*3, -8, '#2E7D32', PIXEL_SIZE);

    drawPixel(-PIXEL_SIZE, 6, color, PIXEL_SIZE);
    drawPixel(PIXEL_SIZE, 6, color, PIXEL_SIZE);
  } else if (isRobot) {
    drawPixel(-PIXEL_SIZE*2, -10, color, PIXEL_SIZE);
    drawPixel(-PIXEL_SIZE, -10, color, PIXEL_SIZE);
    drawPixel(0, -10, color, PIXEL_SIZE);
    drawPixel(PIXEL_SIZE, -10, color, PIXEL_SIZE);
    drawPixel(PIXEL_SIZE*2, -10, color, PIXEL_SIZE);

    drawPixel(-PIXEL_SIZE*2, -4, color, PIXEL_SIZE);
    drawPixel(-PIXEL_SIZE, -4, color, PIXEL_SIZE);
    drawPixel(0, -4, color, PIXEL_SIZE);
    drawPixel(PIXEL_SIZE, -4, color, PIXEL_SIZE);
    drawPixel(PIXEL_SIZE*2, -4, color, PIXEL_SIZE);

    ctx.fillStyle = '#FFEB3B';
    if (blink) {
      drawPixel(-PIXEL_SIZE, -6, '#000', 2);
      drawPixel(PIXEL_SIZE, -6, '#000', 2);
    } else {
      drawPixel(-PIXEL_SIZE, -6, '#FFEB3B', 2);
      drawPixel(PIXEL_SIZE, -6, '#FFEB3B', 2);
    }

    drawPixel(-PIXEL_SIZE*2, -5, '#455A64', 2);

    drawPixel(-PIXEL_SIZE, 6, color, PIXEL_SIZE);
    drawPixel(PIXEL_SIZE, 6, color, PIXEL_SIZE);

    // Кнопка на груди
    ctx.fillStyle = '#FF5722';
    drawPixel(0, 0, '#FF5722', PIXEL_SIZE);
  }

  // Анимация лап при движении
  if (petState !== 'idle' && petState !== 'sleep' && petData && !petData.isSleeping) {
    const legOffset = Math.sin(Date.now() / 150) * 2;
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-PIXEL_SIZE, 5);
    ctx.lineTo(-PIXEL_SIZE - legOffset, 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(PIXEL_SIZE, 5);
    ctx.lineTo(PIXEL_SIZE + legOffset, 8);
    ctx.stroke();
  }
}

function drawSleepingPet() {
  const color = petData.petType === 'CAT' ? '#C0C0C0' : petData.petType === 'DOG' ? '#F4A261' : petData.petType === 'DRAGON' ? '#4CAF50' : '#90A4AE';
  drawPixel(-PIXEL_SIZE, -5, color, PIXEL_SIZE);
  drawPixel(0, -5, color, PIXEL_SIZE);
  drawPixel(PIXEL_SIZE, -5, color, PIXEL_SIZE);
  drawPixel(-PIXEL_SIZE, 0, color, PIXEL_SIZE);
  drawPixel(PIXEL_SIZE, 0, color, PIXEL_SIZE);

  ctx.fillStyle = '#2D4059';
  drawPixel(-PIXEL_SIZE, -6, '#2D4059', 2);
  drawPixel(PIXEL_SIZE, -6, '#2D4059', 2);

  // Zzz
  ctx.fillStyle = '#4CAF50';
  ctx.font = 'bold 14px Courier New';
  ctx.fillText('Z', 12, -10);
  ctx.fillText('z', 18, -6);
}

function drawDeadPet() {
  const color = '#757575';
  drawPixel(-PIXEL_SIZE, -5, color, PIXEL_SIZE);
  drawPixel(0, -5, color, PIXEL_SIZE);
  drawPixel(PIXEL_SIZE, -5, color, PIXEL_SIZE);
  drawPixel(-PIXEL_SIZE, 0, color, PIXEL_SIZE);
  drawPixel(PIXEL_SIZE, 0, color, PIXEL_SIZE);

  ctx.fillStyle = '#2D4059';
  drawPixel(-PIXEL_SIZE, -6, '#2D4059', 2);
  drawPixel(PIXEL_SIZE, -6, '#2D4059', 2);

  ctx.strokeStyle = '#2D4059';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-4, 2);
  ctx.lineTo(4, 2);
  ctx.stroke();
}

window.addEventListener('DOMContentLoaded', init);
