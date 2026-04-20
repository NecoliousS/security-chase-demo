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

function getLaneX(lane, z) {
    const center = canvas.width / 2;
    const spread = LANE_WIDTH * (0.3 + 0.7 * z);
    return center + lane * spread;
}

function getScreenY(z) {
    return HORIZON_Y + (canvas.height - HORIZON_Y) * z;
}

function getScale(z) {
    return 0.2 + 0.8 * z;
}

// ==================== RUNNERS ====================
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

// ==================== SABLE ====================
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

// ==================== UI EVENT LISTENERS ====================
// These MUST be at the top level and properly bound
document.getElementById('playBtn').addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    startGame();
});

document.getElementById('infoBtn').addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('infoScreen').style.display = 'flex';
});

document.getElementById('closeInfoBtn').addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('infoScreen').style.display = 'none';
});

document.getElementById('pauseBtn').addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    pauseGame();
});

document.getElementById('resumeBtn').addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    resumeGame();
});

document.getElementById('menuBtn').addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    returnToMenu();
});

document.getElementById('retryBtn').addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    startGame();
});

document.getElementById('endMenuBtn').addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    returnToMenu();
});

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
    
    const tooClose = obstacles.some(o => o.lane === lane && o.z < 0.15);
    if (tooClose) return;
    
    const roll = Math.random();
    let type = 'crate';
    if (roll > 0.5) type = 'barrier';
    if (roll > 0.82) type = 'traincar';
    
    obstacles.push({
        lane: lane,
        z: -0.3 - Math.random() * 0.4,
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
    
    // CATCH MECHANIC
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
    
    // UPDATE OBSTACLES
    obstacles = obstacles.filter(o => {
        o.z += gameSpeed * secs * 0.12;
        
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
        
        return o.z < 1.3;
    });
    
    // Ground lines
    groundLines.forEach(l => {
        l.z += gameSpeed * secs * 0.12;
        if (l.z > 1) l.z -= 1;
    });
    
    // Particles
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
                    y: getScreenY(runner.z),
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
    for (let i = 0; i < 10; i++) {
        particles.push({
            x: getLaneX(runner.lane, runner.z),
            y: getScreenY(runner.z),
            z: runner.z,
            type: 'flash',
            life: 500,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10
        });
    }
}

function createShockwave(x, z) {
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        particles.push({
            x: x,
            y: getScreenY(z),
            z: z,
            type: 'shockwave',
            life: 800,
            vx: Math.cos(angle) * 5,
            vy: Math.sin(angle) * 5
        });
    }
}

function createZipEffect() {
    for (let i = 0; i < 15; i++) {
        particles.push({
            x: getLaneX(runner.lane, runner.z),
            y: getScreenY(runner.z),
            z: runner.z,
            type: 'zip',
            life: 600,
            vx: (Math.random() - 0.5) * 8,
            vy: -Math.random() * 10
        });
    }
}

// ==================== RENDER ====================
function draw() {
    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
    skyGrad.addColorStop(0, '#0f0f23');
    skyGrad.addColorStop(1, '#2d1b4e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, HORIZON_Y);
    
    // Ground
    const groundGrad = ctx.createLinearGradient(0, HORIZON_Y, 0, canvas.height);
    groundGrad.addColorStop(0, '#1a1a3e');
    groundGrad.addColorStop(1, '#0f0f23');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, HORIZON_Y, canvas.width, canvas.height - HORIZON_Y);
    
    // Ground lines (perspective)
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    groundLines.forEach(l => {
        const y = getScreenY(l.z);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    });
    
    // Lane dividers
    for (let i = -2; i <= 2; i++) {
        const x = getLaneX(i, 1);
        ctx.strokeStyle = 'rgba(233, 69, 96, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, HORIZON_Y);
        ctx.lineTo(getLaneX(i, 0), HORIZON_Y);
        ctx.stroke();
    }
    
    // Draw runner (ahead, smaller)
    if (!runner.caught) {
        drawCharacter(runner.lane, runner.z, runner.data.color, runner.data.accent, runner.animFrame, false);
    }
    
    // Draw obstacles
    obstacles.forEach(o => {
        if (o.z > -0.2 && o.z < 1.2) {
            drawObstacle(o);
        }
    });
    
    // Draw particles
    particles.forEach(p => {
        drawParticle(p);
    });
    
    // Draw player (Norm)
    drawCharacter(player.lane, player.z, '#e94560', '#ff6b6b', player.animFrame, true);
    
    // Draw Sable
    if (sable.active) {
        drawSable();
    }
}

function drawCharacter(lane, z, color, accent, frame, isPlayer) {
    const x = getLaneX(lane, z);
    const y = getScreenY(z) - (isPlayer ? player.jumpY : 0);
    const scale = getScale(z) * (isPlayer ? 1 : 0.7);
    
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 40, 25, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Body
    ctx.fillStyle = color;
    ctx.fillRect(-15, -30, 30, 40);
    
    // Head
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(0, -45, 15, 0, Math.PI * 2);
    ctx.fill();
    
    // Legs (animated)
    const legOffset = Math.sin(frame) * 10;
    ctx.fillStyle = color;
    ctx.fillRect(-12, 10, 10, 20 + legOffset);
    ctx.fillRect(2, 10, 10, 20 - legOffset);
    
    // Arms
    const armOffset = Math.cos(frame) * 8;
    ctx.fillStyle = accent;
    ctx.fillRect(-25, -20, 10, 25 + armOffset);
    ctx.fillRect(15, -20, 10, 25 - armOffset);
    
    // Faction indicator
    if (!isPlayer) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(runner.name, 0, -65);
    }
    
    ctx.restore();
}

function drawObstacle(o) {
    const x = getLaneX(o.lane, o.z);
    const y = getScreenY(o.z);
    const scale = getScale(o.z);
    
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    
    if (o.type === 'crate') {
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(-20, -20, 40, 40);
        ctx.strokeStyle = '#A0522D';
        ctx.lineWidth = 3;
        ctx.strokeRect(-20, -20, 40, 40);
        ctx.beginPath();
        ctx.moveTo(-20, -20);
        ctx.lineTo(20, 20);
        ctx.moveTo(20, -20);
        ctx.lineTo(-20, 20);
        ctx.stroke();
    } else if (o.type === 'barrier') {
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(-25, -15, 50, 30);
        ctx.fillStyle = '#fff';
        ctx.fillRect(-25, -5, 50, 10);
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(-25, -2, 50, 4);
    } else if (o.type === 'traincar') {
        ctx.fillStyle = '#4a5568';
        ctx.fillRect(-35, -40, 70, 80);
        ctx.fillStyle = '#2d3748';
        ctx.fillRect(-30, -35, 60, 70);
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(-25, -30, 10, 10);
        ctx.fillRect(15, -30, 10, 10);
    }
    
    ctx.restore();
}

function drawParticle(p) {
    const x = p.x || getLaneX(0, p.z);
    const y = p.y || getScreenY(p.z);
    const scale = getScale(p.z);
    
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    
    if (p.type === 'spark') {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(p.vx * (400 - p.life) / 100, p.vy * (400 - p.life) / 100, 3, 0, Math.PI * 2);
        ctx.fill();
    } else if (p.type === 'paint') {
        ctx.fillStyle = p.color || '#ff6b6b';
        ctx.globalAlpha = p.life / 3000;
        ctx.beginPath();
        ctx.arc((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 8, 0, Math.PI * 2);
        ctx.fill();
    } else if (p.type === 'flash') {
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = p.life / 500;
        ctx.beginPath();
        ctx.arc(p.vx * (500 - p.life) / 50, p.vy * (500 - p.life) / 50, 5, 0, Math.PI * 2);
        ctx.fill();
    } else if (p.type === 'shockwave') {
        ctx.strokeStyle = '#fbbf24';
        ctx.globalAlpha = p.life / 800;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, (800 - p.life) / 10, 0, Math.PI * 2);
        ctx.stroke();
    } else if (p.type === 'zip') {
        ctx.fillStyle = '#00d4ff';
        ctx.globalAlpha = p.life / 600;
        ctx.fillRect(p.vx * (600 - p.life) / 50, p.vy * (600 - p.life) / 50, 4, 4);
    }
    
    ctx.restore();
}

function drawSable() {
    const x = getLaneX(sable.lane, sable.z);
    const y = getScreenY(sable.z);
    const scale = getScale(sable.z);
    
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 40, 30, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Body (Doberman style)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-20, -25, 40, 50);
    
    // Head
    ctx.fillStyle = '#2d2d2d';
    ctx.beginPath();
    ctx.arc(0, -40, 18, 0, Math.PI * 2);
    ctx.fill();
    
    // Ears (pointy)
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(-15, -50);
    ctx.lineTo(-25, -70);
    ctx.lineTo(-5, -55);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(15, -50);
    ctx.lineTo(25, -70);
    ctx.lineTo(5, -55);
    ctx.fill();
    
    // Eyes (red, angry)
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(-8, -42, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(8, -42, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Legs
    const legOffset = Math.sin(sable.animFrame) * 12;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-15, 25, 12, 25 + legOffset);
    ctx.fillRect(3, 25, 12, 25 - legOffset);
    
    // Label
    ctx.fillStyle = '#ff0000';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SABLE', 0, -80);
    
    ctx.restore();
}

// ==================== GAME LOOP ====================
function gameLoop(timestamp) {
    if (gameState !== STATE.PLAYING && gameState !== STATE.PAUSED) {
        if (gameState === STATE.MENU || gameState === STATE.GAMEOVER) {
            draw();
        }
        return;
    }
    
    const dt = Math.min(timestamp - lastTime, 50);
    lastTime = timestamp;
    
    if (gameState === STATE.PLAYING) {
        update(dt);
    }
    
    draw();
    
    if (gameState === STATE.PLAYING || gameState === STATE.PAUSED) {
        requestAnimationFrame(gameLoop);
    }
}

// Initial draw for menu background
draw();
