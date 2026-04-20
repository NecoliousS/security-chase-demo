// ==================== SUBWAY SURFERS STYLE — NORM CHASING RUNNER ====================
// Camera is behind Norm, Norm runs INTO the screen (away from camera)
// Runner is ahead of Norm, Norm slowly catches up
// Sable appears behind Norm when he hits obstacles (like security guard in Subway Surfers)

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Canvas sizing
function resize() {
    const container = document.getElementById('gameContainer');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}
resize();
window.addEventListener('resize', resize);

// ==================== GAME STATES ====================
const STATE = { MENU: 0, PLAYING: 1, PAUSED: 2, GAMEOVER: 3 };
let gameState = STATE.MENU;

// ==================== PERSPECTIVE SYSTEM ====================
// Z = 0 is HORIZON (far away), Z = 1 is CAMERA (close/bottom of screen)
// World moves toward camera (Z increases) as we run forward
let LANE_WIDTH = 0;
let ROAD_WIDTH = 0;
let HORIZON_Y = 0;

function calcPerspective() {
    LANE_WIDTH = canvas.width * 0.22;
    ROAD_WIDTH = LANE_WIDTH * 3.5;
    HORIZON_Y = canvas.height * 0.28;
}
calcPerspective();
window.addEventListener('resize', calcPerspective);

// Get screen X for a lane at depth Z
function getLaneX(lane, z) {
    const center = canvas.width / 2;
    const spread = LANE_WIDTH * (0.3 + 0.7 * z);
    return center + lane * spread;
}

// Get screen Y for depth Z (0 = horizon/top, 1 = bottom)
function getScreenY(z) {
    return HORIZON_Y + (canvas.height - HORIZON_Y) * z;
}

// Scale at depth Z
function getScale(z) {
    return 0.2 + 0.8 * z;
}

// ==================== RUNNERS (Random) ====================
const ALL_RUNNERS = [
    { name: "Tag", faction: "vandal", diff: 1, color: "#9ca3af", accent: "#6b7280", ability: "none" },
    { name: "Roller", faction: "vandal", diff: 2, color: "#3b82f6", accent: "#1d4ed8", ability: "paint" },
    { name: "Chrome", faction: "vandal", diff: 3, color: "#c0c0c0", accent: "#808080", ability: "flash" },
    { name: "Pixel", faction: "datapunk", diff: 1, color: "#1e293b", accent: "#4ade80", ability: "pixel" },
    { name: "Echo", faction: "datapunk", diff: 2, color: "#1e293b", accent: "#fbbf24", ability: "push" },
    { name: "Zip", faction: "datapunk", diff: 3, color: "#1e293b", accent: "#00d4ff", ability: "zip" }
];

let currentRunner = null;

function pickRandomRunner() {
    const roll = Math.random();
    let pool = roll < 0.4 ? ALL_RUNNERS.filter(r => r.diff === 1) :
               roll < 0.7 ? ALL_RUNNERS.filter(r => r.diff === 2) :
               ALL_RUNNERS.filter(r => r.diff === 3);
    return pool[Math.floor(Math.random() * pool.length)];
}

// ==================== PLAYER (Norm) ====================
// Norm is at Z=0.72 (fixed on screen, running into the distance)
const player = {
    lane: 0,
    targetLane: 0,
    z: 0.72,
    jumping: false,
    jumpY: 0,
    jumpVel: 0,
    sliding: false,
    slideTimer: 0,
    stunTimer: 0,
    animFrame: 0
};

// ==================== RUNNER (Ahead of Norm) ====================
const runner = {
    lane: 0,
    targetLane: 0,
    z: 0.08,
    caught: false,
    escaped: false,
    abilityTimer: 0,
    lastAbility: 0,
    animFrame: 0,
    data: null,
    name: ""
};

// ==================== SABLE (Security Guard Style) ====================
const sable = {
    active: false,
    z: 0.88,
    lane: 0,
    state: "hidden",
    approachTimer: 0,
    animFrame: 0
};

// ==================== WORLD ====================
let obstacles = [];
let groundLines = [];
let particles = [];
let score = 0;
let distance = 0;
let catchDistance = 0;
let gameSpeed = 0;
let baseSpeed = 12;
let runTime = 0;

// ==================== INPUT ====================
const keys = {};
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    keys[k] = true;
    
    if (gameState === STATE.PLAYING) {
        if (e.key === 'ArrowLeft' || k === 'a') moveLane(-1);
        if (e.key === 'ArrowRight' || k === 'd') moveLane(1);
        if ((e.key === 'ArrowUp' || k === 'w' || e.key === ' ') && !player.jumping && !player.sliding) startJump();
        if ((e.key === 'ArrowDown' || k === 's') && !player.jumping && !player.sliding) startSlide();
    }
    if (e.key === 'Escape' && gameState === STATE.PLAYING) pauseGame();
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

// Touch
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, {passive: false});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
        if (gameState === STATE.PLAYING) moveLane(dx > 0 ? 1 : -1);
    } else if (Math.abs(dy) > 50) {
        if (gameState === STATE.PLAYING) {
            if (dy < 0) startJump();
            else startSlide();
        }
    }
}, {passive: false});

// Mobile buttons
document.getElementById('btnLeft').addEventListener('touchstart', (e) => { e.preventDefault(); moveLane(-1); });
document.getElementById('btnRight').addEventListener('touchstart', (e) => { e.preventDefault(); moveLane(1); });
document.getElementById('btnJump').addEventListener('touchstart', (e) => { e.preventDefault(); startJump(); });
document.getElementById('btnSlide').addEventListener('touchstart', (e) => { e.preventDefault(); startSlide(); });

function moveLane(dir) {
    if (player.stunTimer > 0) return;
    player.targetLane = Math.max(-1, Math.min(1, player.targetLane + dir));
}

function startJump() {
    if (player.jumping || player.sliding) return;
    player.jumping = true;
    player.jumpVel = 16;
}

function startSlide() {
    if (player.jumping || player.sliding) return;
    player.sliding = true;
    player.slideTimer = 600;
}

// ==================== MENU ====================
document.getElementById('playBtn').addEventListener('click', startGame);
document.getElementById('infoBtn').addEventListener('click', () => {
    document.getElementById('infoScreen').style.display = 'flex';
});
document.getElementById('closeInfoBtn').addEventListener('click', () => {
    document.getElementById('infoScreen').style.display = 'none';
});
document.getElementById('pauseBtn').addEventListener('click', pauseGame);
document.getElementById('resumeBtn').addEventListener('click', resumeGame);
document.getElementById('menuBtn').addEventListener('click', returnToMenu);
document.getElementById('retryBtn').addEventListener('click', startGame);
document.getElementById('endMenuBtn').addEventListener('click', returnToMenu);

function pauseGame() {
    if (gameState === STATE.PLAYING) {
        gameState = STATE.PAUSED;
        document.getElementById('pauseScreen').style.display = 'flex';
        document.getElementById('hud').style.display = 'none';
        document.getElementById('distanceBar').style.display = 'none';
    }
}

function resumeGame() {
    if (gameState === STATE.PAUSED) {
        gameState = STATE.PLAYING;
        document.getElementById('pauseScreen').style.display = 'none';
        document.getElementById('hud').style.display = 'flex';
        document.getElementById('distanceBar').style.display = 'block';
        lastTime = performance.now();
        requestAnimationFrame(gameLoop);
    }
}

function returnToMenu() {
    gameState = STATE.MENU;
    document.getElementById('startScreen').style.display = 'flex';
    document.getElementById('infoScreen').style.display = 'none';
    document.getElementById('pauseScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('distanceBar').style.display = 'none';
    document.getElementById('catchPopup').style.display = 'none';
}

// ==================== GAME INIT ====================
function startGame() {
    currentRunner = pickRandomRunner();
    
    score = 0;
    distance = 0;
    runTime = 0;
    gameSpeed = baseSpeed;
    obstacles = [];
    groundLines = [];
    particles = [];
    
    player.lane = 0;
    player.targetLane = 0;
    player.z = 0.72;
    player.jumping = false;
    player.jumpY = 0;
    player.jumpVel = 0;
    player.sliding = false;
    player.slideTimer = 0;
    player.stunTimer = 0;
    player.animFrame = 0;
    
    runner.lane = Math.floor(Math.random() * 3) - 1;
    runner.targetLane = runner.lane;
    runner.z = 0.08;
    runner.caught = false;
    runner.escaped = false;
    runner.abilityTimer = 0;
    runner.lastAbility = 0;
    runner.animFrame = 0;
    runner.data = currentRunner;
    runner.name = currentRunner.name;
    
    catchDistance = 100 + Math.random() * 50;
    
    sable.active = false;
    sable.z = 0.88;
    sable.lane = 0;
    sable.state = 'hidden';
    sable.approachTimer = 0;
    sable.animFrame = 0;
    
    for (let i = 0; i < 20; i++) {
        groundLines.push({ z: i * 0.05 });
    }
    
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('catchPopup').style.display = 'none';
    document.getElementById('hud').style.display = 'flex';
    document.getElementById('distanceBar').style.display = 'block';
    
    gameState = STATE.PLAYING;
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

// ==================== SPAWN ====================
function spawnObstacle() {
    const lane = Math.floor(Math.random() * 3) - 1;
    
    // Don't spawn too close to another in same lane
    const tooClose = obstacles.some(o => o.lane === lane && o.z < 0.15);
    if (tooClose) return;
    
    const roll = Math.random();
    let type = 'crate';
    if (roll > 0.5) type = 'barrier';
    if (roll > 0.82) type = 'traincar';
    
    // Spawn BEYOND horizon (negative Z, far ahead of player)
    // They will move toward camera (Z increases) and approach player
    obstacles.push({
        lane: lane,
        z: -0.3 - Math.random() * 0.4,  // Far ahead, beyond horizon
        type: type,
        hit: false,
        pixelated: false
    });
}

// ==================== HIT HANDLING ====================
function hitObstacle(o) {
    o.hit = true;
    player.stunTimer = 500;
    
    const px = getLaneX(player.lane, player.z);
    const py = getScreenY(player.z);
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: px + (Math.random() - 0.5) * 40,
            y: py,
            z: player.z,
            type: 'spark',
            life: 400,
            vx: (Math.random() - 0.5) * 6,
            vy: -Math.random() * 5
        });
    }
    
    if (sable.active) {
        if (sable.state === 'chasing') {
            endGame(false, 'sable');
        }
    } else {
        sable.active = true;
        sable.state = 'approaching';
        sable.lane = player.lane;
        sable.approachTimer = 3000;
        sable.z = 0.95;
    }
}

// ==================== UPDATE ====================
let lastTime = 0;
let spawnTimer = 0;

function update(dt) {
    if (gameState !== STATE.PLAYING) return;
    
    const secs = dt / 1000;
    runTime += dt;
    
    gameSpeed = baseSpeed + Math.min(5, runTime / 8000);
    distance += gameSpeed * secs * 10;
    score += Math.floor(gameSpeed * secs);
    
    // Smooth lane
    player.lane += (player.targetLane - player.lane) * 0.12;
    
    // Player physics
    if (player.jumping) {
        player.jumpY += player.jumpVel;
        player.jumpVel -= 0.9;
        if (player.jumpY <= 0) {
            player.jumpY = 0;
            player.jumping = false;
        }
    }
    if (player.sliding) {
        player.slideTimer -= dt;
        if (player.slideTimer <= 0) player.sliding = false;
    }
    if (player.stunTimer > 0) player.stunTimer -= dt;
    
    // Runner AI
    runner.lane += (runner.targetLane - runner.lane) * 0.08;
    if (Math.random() < 0.006) {
        const newLane = Math.floor(Math.random() * 3) - 1;
        if (Math.abs(newLane - runner.lane) <= 1) runner.targetLane = newLane;
    }
    
    if (catchDistance < 60 && runTime - runner.lastAbility > 4000) {
        runner.lastAbility = runTime;
        useRunnerAbility();
    }
    
    // CATCH MECHANIC: distance decreases over time
    const catchRate = 2.5;
    catchDistance -= catchRate * secs;
    runner.z = 0.08 + (1 - catchDistance / 150) * 0.55;
    if (runner.z > 0.62) runner.z = 0.62;
    
    if (catchDistance <= 0 && !runner.caught && !runner.escaped) {
        runner.caught = true;
        score += 500;
        showCatch();
        setTimeout(() => spawnNewRunner(), 2000);
    }
    
    if (catchDistance > 200 && !runner.caught && !runner.escaped) {
        runner.escaped = true;
        endGame(false, 'escape');
    }
    
    // SABLE
    if (sable.active) {
        sable.lane += (player.lane - sable.lane) * 0.1;
        sable.animFrame += dt * 0.01;
        
        if (sable.state === 'approaching') {
            sable.approachTimer -= dt;
            const progress = 1 - (sable.approachTimer / 3000);
            sable.z = 0.95 - progress * 0.1;
            if (sable.approachTimer <= 0) {
                sable.state = 'chasing';
                sable.z = 0.82;
            }
        } else if (sable.state === 'chasing') {
            sable.z = 0.82 + Math.sin(runTime / 200) * 0.02;
            if (player.stunTimer > 0 && Math.abs(sable.lane - player.lane) < 0.6) {
                endGame(false, 'sable');
            }
        }
    }
    
    // Spawn obstacles
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
        spawnObstacle();
        spawnTimer = 1000 + Math.random() * 1200;
    }
    
    // UPDATE OBSTACLES: Move TOWARD camera (Z increases)
    // They spawn at negative Z (far ahead) and move toward player
    obstacles = obstacles.filter(o => {
        o.z += gameSpeed * secs * 0.12;  // Move toward camera/player
        
        // Collision when obstacle reaches player's Z
        if (o.z > player.z - 0.04 && o.z < player.z + 0.04 && !o.hit) {
            const laneDiff = Math.abs(o.lane - player.lane);
            if (laneDiff < 0.5) {
                if (o.type === 'crate' && !player.jumping) {
                    hitObstacle(o);
                } else if (o.type === 'barrier' && !player.sliding) {
                    hitObstacle(o);
                } else if (o.type === 'traincar') {
                    hitObstacle(o);
                }
            }
        }
        
        // Remove when behind camera
        return o.z < 1.3;
    });
    
    // Ground lines: move toward camera (Z increases)
    groundLines.forEach(l => {
        l.z += gameSpeed * secs * 0.12;
        if (l.z > 1) l.z -= 1;
    });
    
    // Particles: move toward camera
    particles = particles.filter(p => {
        p.life -= dt;
        p.z += gameSpeed * secs * 0.12;
        return p.life > 0 && p.z < 1.5;
    });
    
    player.animFrame += dt * 0.012;
    runner.animFrame += dt * 0.015;
    
    const distFill = Math.max(0, Math.min(100, (1 - catchDistance / 150) * 100));
    document.getElementById('distanceFill').style.width = distFill + '%';
    document.getElementById('distanceText').textContent = Math.max(0, Math.floor(catchDistance)) + 'm to catch';
    document.getElementById('scoreBox').textContent = '$' + score;
}

function useRunnerAbility() {
    const ability = runner.data.ability;
    switch(ability) {
        case 'paint':
            for (let i = 0; i < 3; i++) {
                particles.push({
                    x: getLaneX(runner.lane, runner.z),
                    z: runner.z,
                    type: 'paint',
                    life: 3000,
                    color: runner.data.accent
                });
            }
            break;
        case 'flash':
            catchDistance += 30;
            createFlash();
            break;
        case 'pixel':
            obstacles.forEach(o => {
                if (o.z > 0 && o.z < 0.4) o.pixelated = true;
            });
            break;
        case 'push':
            catchDistance += 20;
            createShockwave(getLaneX(runner.lane, runner.z), runner.z);
            break;
        case 'zip':
            catchDistance += 40;
            runner.targetLane = Math.floor(Math.random() * 3) - 1;
            createZipEffect();
            break;
    }
}

function spawnNewRunner() {
    currentRunner = pickRandomRunner();
    runner.data = currentRunner;
    runner.name = currentRunner.name;
    runner.lane = Math.floor(Math.random() * 3) - 1;
    runner.targetLane = runner.lane;
    runner.z = 0.08;
    runner.caught = false;
    runner.escaped = false;
    runner.lastAbility = runTime;
    catchDistance = 100 + Math.random() * 50;
    sable.active = false;
    sable.state = 'hidden';
    document.getElementById('catchPopup').style.display = 'none';
}

function showCatch() {
    const popup = document.getElementById('catchPopup');
    document.getElementById('catchName').textContent = runner.name + ' apprehended! +$500';
    popup.style.display = 'block';
}

function endGame(win, reason) {
    gameState = STATE.GAMEOVER;
    const title = document.getElementById('endTitle');
    const msg = document.getElementById('endMessage');
    
    if (win) {
        title.textContent = 'CAUGHT!';
        title.className = 'win-color';
        msg.textContent = 'Target apprehended!';
        msg.style.color = '#4ade80';
    } else {
        if (reason === 'sable') {
            title.textContent = 'SABLE CAUGHT YOU!';
            msg.textContent = 'The Doberman got you!';
        } else {
            title.textContent = 'ESCAPED!';
            msg.textContent = 'Target got away!';
        }
        title.className = 'lose-color';
        msg.style.color = '#f87171';
    }
    
    document.getElementById('endRunner').textContent = runner.name;
    document.getElementById('endDist').textContent = Math.floor(distance);
    document.getElementById('endScore').textContent = score;
    document.getElementById('hud').style.display = 'none';
    document.getElementById('distanceBar').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'flex';
}

function createFlash() {
    for (let i = 0; i < 10
