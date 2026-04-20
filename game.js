const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ======================
// GAME STATE
// ======================
let running = false;
let paused = false;

// ======================
// LANES
// ======================
const lanes = [
  canvas.width * 0.35,
  canvas.width * 0.5,
  canvas.width * 0.65
];

// ======================
// PLAYER (NORM)
// ======================
const player = {
  lane: 1,
  y: canvas.height - 140,
  jumping: false,
  sliding: false,
  velY: 0
};

// ======================
// SABLE CHASER
// ======================
const sable = {
  y: canvas.height - 120,
  progress: 0, // how close he is
  speed: 0.12  // increases over time
};

// ======================
// OBSTACLES
// ======================
let obstacles = [];

function spawnObstacle() {
  obstacles.push({
    lane: Math.floor(Math.random() * 3),
    y: -100,
    speed: 6,
    type: Math.random() > 0.5 ? "crate" : "barrel"
  });
}

// ======================
// INPUT SYSTEM
// ======================
document.addEventListener("keydown", (e) => {
  if (!running || paused) return;

  if (e.key === "a" || e.key === "ArrowLeft") {
    player.lane = Math.max(0, player.lane - 1);
  }

  if (e.key === "d" || e.key === "ArrowRight") {
    player.lane = Math.min(2, player.lane + 1);
  }

  if (e.key === "w" || e.key === "ArrowUp") jump();
  if (e.key === "s" || e.key === "ArrowDown") slide();

  if (e.key === "p") togglePause();
});

// ======================
// ACTIONS
// ======================
function jump() {
  if (player.jumping) return;
  player.jumping = true;
  player.velY = -14;

  setTimeout(() => player.jumping = false, 550);
}

function slide() {
  player.sliding = true;
  setTimeout(() => player.sliding = false, 600);
}

// ======================
// COLLISION
// ======================
function checkCollision(o) {
  return (
    o.lane === player.lane &&
    o.y > player.y - 60 &&
    o.y < player.y + 60
  );
}

// ======================
// RESET
// ======================
function reset() {
  obstacles = [];
  player.lane = 1;
  sable.progress = 0;
}

// ======================
// DRAW TRAINYARD BACKGROUND
// ======================
function drawBackground() {
  ctx.fillStyle = "#0b1020";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // rails
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 3;

  lanes.forEach(x => {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  });

  // ground motion lines
  ctx.fillStyle = "#111";
  for (let i = 0; i < 25; i++) {
    ctx.fillRect(0, (i * 60 + Date.now() * 0.05) % canvas.height, canvas.width, 2);
  }
}

// ======================
// MAIN LOOP
// ======================
function loop() {
  if (!running || paused) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  // PLAYER
  const px = lanes[player.lane];

  if (player.jumping) {
    player.y += player.velY;
    player.velY += 0.8;
  } else {
    player.y = canvas.height - 140;
  }

  ctx.fillStyle = "cyan";
  ctx.fillRect(px - 25, player.y, 50, player.sliding ? 35 : 70);

  // OBSTACLES
  for (let i = 0; i < obstacles.length; i++) {
    let o = obstacles[i];
    o.y += o.speed;

    ctx.fillStyle = o.type === "crate" ? "#8B4513" : "#555";
    ctx.fillRect(lanes[o.lane] - 25, o.y, 50, 50);

    if (checkCollision(o)) {
      reset();
    }
  }

  // SABLE CHASE PRESSURE
  sable.progress += sable.speed;

  ctx.fillStyle = "black";
  ctx.fillRect(canvas.width / 2 - 30, canvas.height - 120, 60, 60);

  if (sable.progress > 100) {
    reset(); // SABLE catches you
  }

  requestAnimationFrame(loop);
}

// ======================
// SPAWN SYSTEM
// ======================
setInterval(() => {
  if (running && !paused) spawnObstacle();
}, 1100);

// ======================
// MENU HOOKS (YOU ALREADY HAVE HTML)
// ======================
document.getElementById("playBtn").onclick = () => {
  document.getElementById("menu").style.display = "none";
  running = true;
  loop();
};

document.getElementById("infoBtn").onclick = () => {
  document.getElementById("infoText").classList.toggle("hidden");
};

function togglePause() {
  paused = !paused;
  document.getElementById("pauseScreen").classList.toggle("hidden");
  if (!paused) loop();
}
