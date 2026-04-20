const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ----------------------
// GAME STATE
// ----------------------
let gameRunning = false;
let paused = false;

// ----------------------
// LANES (LEFT MIDDLE RIGHT)
// ----------------------
const lanes = [
  canvas.width * 0.3,
  canvas.width * 0.5,
  canvas.width * 0.7
];

// ----------------------
// PLAYER
// ----------------------
const player = {
  lane: 1,
  y: canvas.height - 150,
  width: 50,
  height: 80,
  jumping: false,
  sliding: false,
  velocityY: 0
};

// ----------------------
// SABLE (DOG CHASER)
// ----------------------
const sable = {
  x: canvas.width / 2,
  y: canvas.height - 120,
  width: 70,
  height: 70,
  speed: 2
};

// ----------------------
// OBSTACLES
// ----------------------
let obstacles = [];

function spawnObstacle() {
  const lane = Math.floor(Math.random() * 3);

  obstacles.push({
    lane: lane,
    y: -100,
    width: 60,
    height: 60,
    type: Math.random() > 0.5 ? "crate" : "barrel"
  });
}

// ----------------------
// INPUT CONTROLS
// ----------------------
document.addEventListener("keydown", (e) => {
  if (!gameRunning || paused) return;

  if (e.key === "ArrowLeft" || e.key === "a") {
    player.lane = Math.max(0, player.lane - 1);
  }

  if (e.key === "ArrowRight" || e.key === "d") {
    player.lane = Math.min(2, player.lane + 1);
  }

  if (e.key === "ArrowUp" || e.key === "w") {
    jump();
  }

  if (e.key === "ArrowDown" || e.key === "s") {
    slide();
  }

  if (e.key === "p") {
    togglePause();
  }
});

// ----------------------
// MOVEMENT ACTIONS
// ----------------------
function jump() {
  if (player.jumping) return;
  player.jumping = true;
  player.velocityY = -15;

  setTimeout(() => {
    player.jumping = false;
  }, 600);
}

function slide() {
  player.sliding = true;
  setTimeout(() => {
    player.sliding = false;
  }, 600);
}

// ----------------------
// GAME LOOP
// ----------------------
function update() {
  if (!gameRunning || paused) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground();

  // PLAYER POSITION
  const x = lanes[player.lane];

  // gravity
  if (player.jumping) {
    player.y += player.velocityY;
    player.velocityY += 0.8;
  } else {
    player.y = canvas.height - 150;
  }

  // DRAW PLAYER
  ctx.fillStyle = "cyan";
  ctx.fillRect(
    x - 25,
    player.y,
    player.width,
    player.sliding ? 40 : player.height
  );

  // OBSTACLES
  for (let i = 0; i < obstacles.length; i++) {
    let o = obstacles[i];
    o.y += 6;

    ctx.fillStyle = o.type === "crate" ? "brown" : "gray";
    ctx.fillRect(lanes[o.lane] - 25, o.y, o.width, o.height);

    // collision
    if (
      o.lane === player.lane &&
      o.y > player.y - 50 &&
      o.y < player.y + 80
    ) {
      resetGame();
    }
  }

  // SABLE CHASER (moves faster over time)
  sable.speed += 0.001;
  sable.y = canvas.height - 120;

  ctx.fillStyle = "black";
  ctx.fillRect(sable.x - 30, sable.y, sable.width, sable.height);

  requestAnimationFrame(update);
}

// ----------------------
// BACKGROUND (TRAINYARD)
// ----------------------
function drawBackground() {
  ctx.fillStyle = "#0a0f1f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // rails
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 4;

  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(lanes[i], 0);
    ctx.lineTo(lanes[i], canvas.height);
    ctx.stroke();
  }

  // moving ground lines
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, i * 50, canvas.width, 2);
  }
}

// ----------------------
// RESET
// ----------------------
function resetGame() {
  obstacles = [];
  player.lane = 1;
}

// ----------------------
// PAUSE
// ----------------------
function togglePause() {
  paused = !paused;
  document.getElementById("pauseScreen").classList.toggle("hidden");
  if (!paused) update();
}

// ----------------------
// MENU BUTTONS
// ----------------------
document.getElementById("playBtn").onclick = () => {
  document.getElementById("menu").style.display = "none";
  gameRunning = true;
  update();
};

document.getElementById("infoBtn").onclick = () => {
  document.getElementById("infoText").classList.toggle("hidden");
};

// ----------------------
// SPAWN LOOP
// ----------------------
setInterval(() => {
  if (gameRunning && !paused) spawnObstacle();
}, 1200);
