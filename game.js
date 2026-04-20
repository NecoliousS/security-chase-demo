// ==================== SUBWAY SURFERS STYLE SECURITY CHASE ====================

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
const STATE = { MENU: 0, PLAYING: 1, PAUSED: 2, GAMEOVER: 3, CAUGHT: 4 };
let gameState = STATE.MENU;

// ==================== 3-LANE SYSTEM (Subway Surfers style) ====================
const LANES = [-1, 0, 1]; // left, center, right
let LANE_WIDTH = 0;
let ROAD_WIDTH = 0;
let HORIZON_Y = 0;
let VANISHING_X = 0;
let VANISHING_Y = 0;

function calcPerspective() {
    LANE_WIDTH = canvas.width * 0.22;
    ROAD_WIDTH = LANE_WIDTH * 3.5;
    HORIZON_Y = canvas.height * 0.25;
    VANISHING_X = canvas.width / 2;
    VANISHING_Y = HORIZON_Y;
}
calcPerspective();
window.addEventListener('resize', calcPerspective);

// Convert lane to screen X at a given Z depth (0 = horizon, 1 = bottom)
function getLaneX(lane, z) {
    const centerAtZ = VANISHING_X;
    const laneOffset = lane * LANE_WIDTH * (0.2 + 0.8 * z);
    return centerAtZ + laneOffset;
}

// Convert world Z to screen Y (perspective)
function getScreenY(z) {
    return VANISHING_Y + (canvas.height - VANISHING_Y) * z;
}

// Scale factor based on Z
function getScale(z) {
    return 0.15 + 0.85 * z;
}

// ==================== CHARACTERS (Random Spawn) ====================
const ALL_RUNNERS = [
    // VANDALS
    { name: "Tag", faction: "vandal", diff: 1, color: "#9ca3af", accent: "#6b7280", ability: "none" },
    { name: "Roller", faction: "vandal", diff: 2, color: "#3b82f6", accent: "#1d4ed8", ability: "paint" },
    { name: "Chrome", faction: "vandal", diff: 3, color: "#c0c0c0", accent: "#808080", ability: "flash" },
    // DATAPUNKS
    { name: "Pixel", faction: "datapunk", diff: 1, color: "#1e293b", accent: "#4ade80", ability: "pixel" },
    { name: "Echo", faction: "datapunk", diff: 2, color: "#1e293b", accent: "#fbbf24", ability: "push" },
    { name: "Zip", faction: "datapunk", diff: 3, color: "#1e293b", accent: "#00d4ff", ability: "zip" }
];

let currentRunner = null;

function pickRandomRunner() {
    const diffRoll = Math.random();
    let pool;
    if (diffRoll < 0.4) pool = ALL_RUNNERS.filter(r => r.diff === 1);
    else if (diffRoll < 0.7) pool = ALL_RUNNERS.filter(r => r.diff === 2);
    else pool = ALL_RUNNERS.filter(r => r.diff === 3);
    return pool[Math.floor(Math.random() * pool.length)];
}

// ==================== PLAYER (Norm) ====================
const player = {
    lane: 0, // -1, 0, 1
    targetLane: 0,
    x: 0, y: 0,
    z: 0.85, // fixed distance from camera
    jumping: false,
    jumpY: 0,
    jumpVel: 0,
    sliding: false,
    slideTimer: 0,
    width: 50, height: 80,
    stunTimer: 0,
    flashTimer: 0,
    pushTimer: 0,
    animFrame: 0
};

// ==================== RUNNER ====================
const runner = {
    lane: 0,
    targetLane: 0,
    x: 0, y: 0,
    z: 0.3, // starts far ahead
    targetZ: 0.3,
    width: 45, height: 75,
    caught: false,
    escaped: false,
    abilityTimer: 0,
    lastAbility: 0,
    animFrame: 0,
    name: "",
    data: null
};

// ==================== SABLE (Giant Doberman) ====================
const sable = {
    active: false,
    x: 0, y: 0,
    z: 0.95, // behind player
    lane: 0,
    state: "idle", // idle, chase, bite
    timer: 0,
    animFrame: 0,
    roarTimer: 0
};

// ==================== WORLD ====================
let obstacles = [];
let decorations = [];
let particles = [];
let groundLines = [];
let score = 0;
let distance = 0;
let runTime = 0;
let gameSpeed = 0;
let baseSpeed = 12;
let catchStreak = 0;

// ==================== INPUT ====================
const keys = {};
let touchStartX = 0;
let touchStartY = 0;
let touchTime = 0;

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

// Touch / Swipe
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchTime = Date.now();
}, {passive: false});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const dt = Date.now() - touchTime;
    
    if (dt < 300 && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        // Tap - treat as jump
        if (gameState === STATE.PLAYING && !player.jumping && !player.sliding) startJump();
    } else if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
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
    player.jumping = true;
    player.jumpVel = 18;
}

function startSlide() {
    player.sliding = true;
    player.slideTimer = 700;
}

// ==================== MENU HANDLERS ====================
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
    }
}

function resumeGame() {
    if (gameState === STATE.PAUSED) {
        gameState = STATE.PLAYING;
        document.getElementById('pauseScreen').style.display = 'none';
        document.getElementById('hud').style.display = 'flex';
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
    document.getElementById('catchPopup').style.display = 'none';
}

// ==================== GAME INIT ====================
function startGame() {
    // Pick random runner
    currentRunner = pickRandomRunner();
    
    // Reset
    score = 0;
    distance = 0;
    runTime = 0;
    gameSpeed = baseSpeed;
    obstacles = [];
    decorations = [];
    particles = [];
    groundLines = [];
    catchStreak = 0;
    
    // Reset player
    player.lane = 0;
    player.targetLane = 0;
    player.z = 0.85;
    player.jumping = false;
    player.jumpY = 0;
    player.jumpVel = 0;
    player.sliding = false;
    player.slideTimer = 0;
    player.stunTimer = 0;
    player.flashTimer = 0;
    player.pushTimer = 0;
    player.animFrame = 0;
    
    // Reset runner
    runner.lane = Math.floor(Math.random() * 3) - 1;
    runner.targetLane = runner.lane;
    runner.z = 0.25;
    runner.targetZ = 0.25;
    runner.caught = false;
    runner.escaped = false;
    runner.abilityTimer = 0;
    runner.lastAbility = 0;
    runner.animFrame = 0;
    runner.name = currentRunner.name;
    runner.data = currentRunner;
    
    // Reset Sable
    sable.active = false;
    sable.z = 0.95;
    sable.lane = 0;
    sable.state = 'idle';
    sable.timer = 0;
    sable.animFrame = 0;
    sable.roarTimer = 0;
    
    // Generate initial ground lines
    for (let i = 0; i < 20; i++) {
        groundLines.push({ z: i * 0.05, offset: 0 });
    }
    
    // UI
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('catchPopup').style.display = 'none';
    document.getElementById('hud').style.display = 'flex';
    
    gameState = STATE.PLAYING;
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

// ==================== UPDATE ====================
let lastTime = 0;
let spawnTimer = 0;
let decorSpawnTimer = 0;

function update(dt) {
    if (gameState !== STATE.PLAYING) return;
    
    const secs = dt / 1000;
    runTime += dt;
    
    // Speed increases over time
    gameSpeed = baseSpeed + Math.min(8, runTime / 10000);
    
    // Update distance
    distance += gameSpeed * secs * 10;
    score += Math.floor(gameSpeed * secs);
    
    // Smooth lane transition
    player.lane += (player.targetLane - player.lane) * 0.15;
    
    // Update player physics
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
    
    // Stun/push timers
    if (player.stunTimer > 0) player.stunTimer -= dt;
    if (player.flashTimer > 0) player.flashTimer -= dt;
    if (player.pushTimer > 0) {
        player.pushTimer -= dt;
        distance -= 20 * secs;
    }
    
    // Runner AI
    runner.lane += (runner.targetLane - runner.lane) * 0.1;
    runner.z += (runner.targetZ - runner.z) * 0.05;
    
    // Runner gets closer over time (player catches up)
    if (!runner.caught && !runner.escaped) {
        runner.targetZ = Math.max(0.35, 0.6 - (runTime / 30000)); // gets closer as time passes
        
        // Runner lane switching
        if (Math.random() < 0.008) {
            const newLane = Math.floor(Math.random() * 3) - 1;
            if (Math.abs(newLane - runner.lane) <= 1) runner.targetLane = newLane;
        }
        
        // Runner abilities
        if (runner.z < 0.5 && runTime - runner.lastAbility > 3000 + Math.random() * 2000) {
            runner.lastAbility = runTime;
            useRunnerAbility();
        }
    }
    
    // Check catch
    if (!runner.caught && !runner.escaped && runner.z > 0.78 && Math.abs(runner.lane - player.lane) < 0.5) {
        runner.caught = true;
        catchStreak++;
        score += 500;
        showCatchPopup();
        setTimeout(() => spawnNewRunner(), 2000);
    }
    
    // Check escape
    if (!runner.caught && !runner.escaped && runner.z < 0.15) {
        runner.escaped = true;
        endGame(false);
    }
    
    // Sable logic
    if (!sable.active && runTime > 8000) {
        sable.active = true;
        sable.state = 'chase';
        sable.lane = player.lane;
    }
    
    if (sable.active) {
        sable.lane += (player.lane - sable.lane) * 0.08;
        sable.z = 0.88 + Math.sin(runTime / 300) * 0.02;
        
        // If player hits obstacle, Sable catches them
        if (player.stunTimer > 0 && Math.abs(sable.lane - player.lane) < 0.5) {
            endGame(false, 'sable');
        }
        
        // Sable roar
        sable.roarTimer += dt;
    }
    
    // Spawn obstacles
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
        spawnObstacle();
        spawnTimer = 1200 + Math.random() * 1500 - Math.min(500, runTime / 50);
    }
    
    // Spawn decorations
    decorSpawnTimer -= dt;
    if (decorSpawnTimer <= 0) {
        spawnDecoration();
        decorSpawnTimer = 800 + Math.random() * 1200;
    }
    
    // Update obstacles
    obstacles = obstacles.filter(o => {
        o.z -= gameSpeed * secs * 0.08;
        
        // Collision check
        if (o.z > 0.75 && o.z < 0.9 && !o.hit) {
            const laneDiff = Math.abs(o.lane - player.lane);
            if (laneDiff < 0.6) {
                // Same lane - check jump/slide
                if (o.type === 'crate' && !player.jumping) {
                    hitObstacle(o);
                } else if (o.type === 'barrier' && !player.sliding) {
                    hitObstacle(o);
                } else if (o.type === 'traincar') {
                    hitObstacle(o);
                }
            }
        }
        
        return o.z > -0.1;
    });
    
    // Update decorations
    decorations = decorations.filter(d => {
        d.z -= gameSpeed * secs * 0.08;
        return d.z > -0.1;
    });
    
    // Update ground lines
    groundLines.forEach(l => {
        l.z -= gameSpeed * secs * 0.08;
        if (l.z < 0) l.z += 1;
    });
    
    // Update particles
    particles = particles.filter(p => {
        p.life -= dt;
        p.z -= gameSpeed * secs * 0.08;
        if (p.type === 'shockwave') p.radius += 2;
        return p.life > 0;
    });
    
    // Animation frames
    player.animFrame += dt * 0.01;
    runner.animFrame += dt * 0.012;
    sable.animFrame += dt * 0.008;
    
    // HUD
    document.getElementById('scoreBox').textContent = `$${score}`;
}

function hitObstacle(o) {
    o.hit = true;
    player.stunTimer = 600;
    createSparks(getLaneX(player.lane, 0.85), getScreenY(0.85));
    
    // Screen shake effect
    shakeScreen = 10;
}

let shakeScreen = 0;

function useRunnerAbility() {
    const ability = runner.data.ability;
    
    switch(ability) {
        case 'paint':
            // Drop paint puddles
            for (let i = 0; i < 3; i++) {
                particles.push({
                    x: getLaneX(runner.lane, runner.z - i * 0.05),
                    z: runner.z - i * 0.05,
                    type: 'paint',
                    life: 4000,
                    color: runner.data.accent
                });
            }
            break;
            
        case 'flash':
            player.flashTimer = 1200;
            runner.targetZ = Math.max(0.3, runner.z - 0.15);
            createFlash();
            break;
            
        case 'pixel':
            // Pixelate upcoming obstacles
            obstacles.forEach(o => {
                if (o.z > runner.z && o.z < runner.z + 0.3) o.pixelated = true;
            });
            break;
            
        case 'push':
            player.pushTimer = 800;
            runner.targetZ = Math.max(0.3, runner.z - 0.1);
            createShockwave(getLaneX(runner.lane, runner.z), runner.z);
            break;
            
        case 'zip':
            runner.targetZ = Math.max(0.25, runner.z - 0.2);
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
    runner.z = 0.25;
    runner.targetZ = 0.25;
    runner.caught = false;
    runner.escaped = false;
    runner.lastAbility = runTime;
}

function showCatchPopup() {
    const popup = document.getElementById('catchPopup');
    document.getElementById('catchName').textContent = `${runner.name} apprehended! +$500`;
    popup.style.display = 'block';
    setTimeout(() => popup.style.display = 'none', 1500);
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
        title.textContent = reason === 'sable' ? 'SABLE GOT YOU!' : 'ESCAPED!';
        title.className = 'lose-color';
        msg.textContent = reason === 'sable' ? 'The Doberman caught you!' : 'Target got away!';
        msg.style.color = '#f87171';
    }
    
    document.getElementById('endRunner').textContent = runner.name;
    document.getElementById('endDist').textContent = Math.floor(distance);
    document.getElementById('endScore').textContent = score;
    
    document.getElementById('hud').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'flex';
}

// ==================== SPAWNING ====================
function spawnObstacle() {
    const lane = Math.floor(Math.random() * 3) - 1;
    const roll = Math.random();
    
    let type = 'crate';
    if (roll > 0.5) type = 'barrier';
    if (roll > 0.8) type = 'traincar';
    
    // Don't spawn if too close to another in same lane
    const tooClose = obstacles.some(o => o.lane === lane && o.z > 0.8);
    if (tooClose) return;
    
    obstacles.push({
        lane: lane,
        z: 1.2,
        type: type,
        hit: false,
        pixelated: false
    });
}

function spawnDecoration() {
    const side = Math.random() > 0.5 ? -1 : 1;
    decorations.push({
        side: side,
        z: 1.2,
        type: Math.random() > 0.6 ? 'lamp' : 'crate_stack'
    });
}

function createSparks(x, y) {
    for (let i = 0; i < 10; i++) {
        particles.push({
            x: x + (Math.random() - 0.5) * 40,
            y: y,
            z: 0.85,
            type: 'spark',
            life: 500,
            vx: (Math.random() - 0.5) * 8,
            vy: -Math.random() * 6
        });
    }
}

function createFlash() {
    for (let i = 0; i < 15; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            z: 0,
            type: 'flash',
            life: 400,
            size: 50 + Math.random() * 100
        });
    }
}

function createShockwave(x, z) {
    particles.push({
        x: x, z: z,
        type: 'shockwave',
        life: 600,
        radius: 10,
        maxRadius: 80
    });
}

function createZipEffect() {
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: getLaneX(runner.lane, runner.z),
            z: runner.z,
            type: 'zip',
            life: 400,
            angle: (Math.PI * 2 / 8) * i
        });
    }
}

// ==================== DRAWING ====================
function draw() {
    // Clear
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Screen shake
    ctx.save();
    if (shakeScreen > 0) {
        ctx.translate((Math.random() - 0.5) * shakeScreen, (Math.random() - 0.5) * shakeScreen);
        shakeScreen *= 0.9;
        if (shakeScreen < 0.5) shakeScreen = 0;
    }
    
    // ==================== SKY ====================
    const skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
    skyGrad.addColorStop(0, '#0a0a2e');
    skyGrad.addColorStop(0.5, '#1a1a4e');
    skyGrad.addColorStop(1, '#2d2d6e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, HORIZON_Y);
    
    // Stars
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 60; i++) {
        const sx = (i * 137.5 + distance * 0.01) % canvas.width;
        const sy = (i * 71.3) % (HORIZON_Y * 0.8);
        const twinkle = 0.3 + Math.sin(Date.now() / 1000 + i * 2) * 0.3;
        ctx.globalAlpha = twinkle;
        ctx.beginPath();
        ctx.arc(sx, sy, 1 + (i % 2), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    
    // Moon
    ctx.fillStyle = '#fffde7';
    ctx.beginPath();
    ctx.arc(canvas.width * 0.75, HORIZON_Y * 0.3, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0a2e';
    ctx.beginPath();
    ctx.arc(canvas.width * 0.75 + 8, HORIZON_Y * 0.3 - 5, 22, 0, Math.PI * 2);
    ctx.fill();
    
    // ==================== GROUND (Train Yard) ====================
    // Main ground
    const groundGrad = ctx.createLinearGradient(0, HORIZON_Y, 0, canvas.height);
    groundGrad.addColorStop(0, '#3d3425');
    groundGrad.addColorStop(0.3, '#4a3f2f');
    groundGrad.addColorStop(1, '#2d261e');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, HORIZON_Y, canvas.width, canvas.height - HORIZON_Y);
    
    // Perspective ground lines (railroad ties)
    ctx.strokeStyle = '#5c4d3c';
    ctx.lineWidth = 3;
    groundLines.forEach(l => {
        const y = getScreenY(l.z);
        const widthAtZ = ROAD_WIDTH * (0.2 + 0.8 * l.z);
        ctx.beginPath();
        ctx.moveTo(VANISHING_X - widthAtZ / 2, y);
        ctx.lineTo(VANISHING_X + widthAtZ / 2, y);
        ctx.stroke();
    });
    
    // Rail tracks (3 lanes)
    ctx.strokeStyle = '#718096';
    ctx.lineWidth = 4;
    for (let lane = -1; lane <= 1; lane++) {
        const xAtHorizon = getLaneX(lane, 0);
        const xAtBottom = getLaneX(lane, 1);
        ctx.beginPath();
        ctx.moveTo(xAtHorizon, HORIZON_Y);
        ctx.lineTo(xAtBottom, canvas.height);
        ctx.stroke();
    }
    
    // Center rail glow
    ctx.strokeStyle = 'rgba(113, 128, 150, 0.3)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(VANISHING_X - 5, HORIZON_Y);
    ctx.lineTo(VANISHING_X - 15, canvas.height);
    ctx.stroke();
    
    // Gravel texture
    ctx.fillStyle = '#3d3425';
    for (let i = 0; i < 30; i++) {
        const gz = (i * 0.033 + distance * 0.0005) % 1;
        const gy = getScreenY(gz);
        const gx = (i * 97) % canvas.width;
        ctx.fillRect(gx, gy, 4, 3);
    }
    
    // ==================== DECORATIONS (Background) ====================
    decorations.forEach(d => {
        const y = getScreenY(d.z);
        const s = getScale(d.z);
        const x = d.side < 0 ? getLaneX(-2, d.z) : getLaneX(2, d.z);
        
        ctx.globalAlpha = Math.min(1, d.z * 2);
        
        if (d.type === 'lamp') {
            // Lamp post
            ctx.fillStyle = '#4a5568';
            ctx.fillRect(x - 3 * s, y - 120 * s, 6 * s, 120 * s);
            // Light
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(x, y - 120 * s, 8 * s, 0, Math.PI * 2);
            ctx.fill();
            // Glow
            ctx.fillStyle = 'rgba(255,215,0,0.15)';
            ctx.beginPath();
            ctx.arc(x, y - 120 * s, 40 * s, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Crate stacks
            ctx.fillStyle = '#5a4a3a';
            ctx.fillRect(x - 25 * s, y - 40 * s, 50 * s, 40 * s);
            ctx.fillStyle = '#6b5b4b';
            ctx.fillRect(x - 20 * s, y - 70 * s, 40 * s, 30 * s);
        }
        
        ctx.globalAlpha = 1;
    });
    
    // ==================== OBSTACLES ====================
    obstacles.forEach(o => {
        const y = getScreenY(o.z);
        const s = getScale(o.z);
        const x = getLaneX(o.lane, o.z);
        
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(x, y + 5, 30 * s, 8 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        
        if (o.type === 'crate') {
            // Wooden crate - must jump over
            ctx.fillStyle = '#8B4513';
            const crateH = 50 * s;
            const crateW = 55 * s;
            ctx.fillRect(x - crateW / 2, y - crateH, crateW, crateH);
            
            // Wood detail
            ctx.fillStyle = '#A0522D';
            ctx.fillRect(x - crateW / 2 + 3, y - crateH + 3, crateW - 6, crateH / 3);
            ctx.fillRect(x - crateW / 2 + 3, y - crateH / 2, crateW - 6, crateH / 3);
            
            // Warning symbol
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.moveTo(x, y - crateH + 8);
            ctx.lineTo(x + 8, y - crateH + 20);
            ctx.lineTo(x - 8, y - crateH + 20);
            ctx.fill();
            
        } else if (o.type === 'barrier') {
            // Barrier - must slide under
            ctx.fillStyle = '#FF6B35';
            const barH = 35 * s;
            const barW = 70 * s;
            const barY = y - 100 * s; // high up
            
            ctx.fillRect(x - barW / 2, barY, barW, barH);
            
            // Stripes
            ctx.fillStyle = '#FFD700';
            for (let i = 0; i < 4; i++) {
                ctx.fillRect(x - barW / 2 + i * 18 * s, barY, 8 * s, barH);
            }
            
            // Support poles
            ctx.fillStyle = '#718096';
            ctx.fillRect(x - barW / 2 + 5, barY + barH, 6 * s, 100 * s);
            ctx.fillRect(x + barW / 2 - 15, barY + barH, 6 * s, 100 * s);
            
        } else if (o.type === 'traincar') {
            // Train car blocking lane
            ctx.fillStyle = '#2d3748';
            const carW = 90 * s;
            const carH = 70 * s;
            ctx.fillRect(x - carW / 2, y - carH, carW, carH);
            
            // Windows
            ctx.fillStyle = '#1a202c';
            ctx.fillRect(x - carW / 2 + 8, y - carH + 10, carW - 16, 25 * s);
            
            // Graffiti
            ctx.fillStyle = '#e94560';
            ctx.font = `bold ${12 * s}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.save();
            ctx.translate(x, y - carH / 2);
            ctx.rotate(-0.1);
            ctx.fillText('VANDALS', 0, 0);
            ctx.restore();
        }
        
        // Pixelate effect
        if (o.pixelated) {
            ctx.fillStyle = 'rgba(0,255,0,0.2)';
            ctx.fillRect(x - 40 * s, y - 60 * s, 80 * s, 70 * s);
        }
    });
    
    // ==================== PARTICLES ====================
    particles.forEach(p => {
        const y = p.y || getScreenY(p.z);
        const s = getScale(p.z);
        
        if (p.type === 'paint') {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life / 4000;
            ctx.beginPath();
            ctx.arc(p.x, y, 35 * s, 0, Math.PI * 2);
            ctx.fill();
            
        } else if (p.type === 'spark') {
            ctx.fillStyle = '#ffd700';
            ctx.globalAlpha = p.life / 500;
            const px = p.x + p.vx * (500 - p.life) / 10;
            const py = p.y + p.vy * (500 - p.life) / 10;
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fill();
            
        } else if (p.type === 'flash') {
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = p.life / 400;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            
        } else if (p.type === 'shockwave') {
            ctx.strokeStyle = '#00d4ff';
            ctx.lineWidth = 3;
            ctx.globalAlpha = p.life / 600;
            ctx.beginPath();
            ctx.arc(p.x, getScreenY(p.z), p.radius * s, 0, Math.PI * 2);
            ctx.stroke();
            
        } else if (p.type === 'zip') {
            ctx.fillStyle = '#00d4ff';
            ctx.globalAlpha = p.life / 400;
            const zx = p.x + Math.cos(p.angle + Date.now() / 200) * 30 * s;
            const zy = getScreenY(p.z) + Math.sin(p.angle + Date.now() / 200) * 20 * s;
            ctx.beginPath();
            ctx.arc(zx, zy, 5 * s, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    ctx.globalAlpha = 1;
    
    // ==================== RUNNER (Ahead of player) ====================
    if (!runner.caught && !runner.escaped) {
        const rZ = runner.z;
        const rY = getScreenY(rZ);
        const rX = getLaneX(runner.lane, rZ);
        const rS = getScale(rZ);
        
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(rX, rY + 5, 20 * rS, 6 * rS, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Runner body
        const runBounce = Math.sin(runner.animFrame) * 5 * rS;
        
        if (runner.data.faction === 'vandal') {
            // Casual clothes
            ctx.fillStyle = runner.data.color;
            ctx.beginPath();
            ctx.ellipse(rX, rY - 30 * rS + runBounce, 15 * rS, 20 * rS, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Head
            ctx.fillStyle = '#fca5a5';
            ctx.beginPath();
            ctx.arc(rX, rY - 55 * rS + runBounce, 12 * rS, 0, Math.PI * 2);
            ctx.fill();
            
            // Hood/hair
            ctx.fillStyle = runner.data.accent;
            ctx.beginPath();
            ctx.arc(rX, rY - 58 * rS + runBounce, 13 * rS, Math.PI, 0);
            ctx.fill();
            
        } else {
            // Tech suit
            ctx.fillStyle = runner.data.color;
            ctx.beginPath();
            ctx.ellipse(rX, rY - 30 * rS + runBounce, 14 * rS, 19 * rS, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Neon stripe
            ctx.strokeStyle = runner.data.accent;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(rX - 12 * rS, rY - 40 * rS + runBounce);
            ctx.lineTo(rX + 12 * rS, rY - 40 * rS + runBounce);
            ctx.stroke();
            
            // Head
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(rX, rY - 53 * rS + runBounce, 11 * rS, 0, Math.PI * 2);
            ctx.fill();
            
            // Visor
            ctx.fillStyle = runner.data.accent;
            ctx.fillRect(rX - 10 * rS, rY - 56 * rS + runBounce, 20 * rS, 5 * rS);
        }
        
        // Legs running
        ctx.fillStyle = runner.data.faction === 'vandal' ? '#374151' : '#0f172a';
        const legSwing = Math.sin(runner.animFrame * 2) * 15 * rS;
        ctx.fillRect(rX - 8 * rS, rY - 15 * rS + runBounce, 6 * rS, 18 * rS + legSwing);
        ctx.fillRect(rX + 2 * rS, rY - 15 * rS + runBounce, 6 * rS, 18 * rS - legSwing);
        
        // Name tag
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${9 * rS}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(runner.name, rX, rY - 75 * rS + runBounce);
        
        // Distance indicator
        if (rZ < 0.5) {
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.font = `${8 * rS}px sans-serif`;
            ctx.fillText(`${Math.floor((0.85 - rZ) * 100)}m`, rX, rY - 85 * rS + runBounce);
        }
    }
    
    // ==================== SABLE (Behind player) ====================
    if (sable.active) {
        const sZ = sable.z;
        const sY = getScreenY(sZ);
        const sX = getLaneX(sable.lane, sZ);
        const sS = getScale(sZ);
        
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(sX, sY + 5, 35 * sS, 10 * sS, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Body (Doberman)
        ctx.fillStyle = '#1a1a1a';
        
        // Main body - muscular
        ctx.beginPath();
        ctx.ellipse(sX, sY - 25 * sS, 30 * sS, 28 * sS, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Chest
        ctx.beginPath();
        ctx.ellipse(sX, sY - 40 * sS, 22 * sS, 20 * sS, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Head
        ctx.beginPath();
        ctx.ellipse(sX, sY - 65 * sS, 18 * sS, 16 * sS, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Snout
        ctx.fillStyle = '#2d2d2d';
        ctx.beginPath();
        ctx.ellipse(sX, sY - 72 * sS, 12 * sS, 10 * sS, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Pointed ears
        ctx.fillStyle = '#1a1a1a';
        const earWiggle = Math.sin(sable.animFrame * 3) * 3;
        ctx.beginPath();
        ctx.moveTo(sX - 15 * sS, sY - 75 * sS);
        ctx.lineTo(sX - 20 * sS + earWiggle, sY - 100 * sS);
        ctx.lineTo(sX - 5 * sS, sY - 78 * sS);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(sX + 15 * sS, sY - 75 * sS);
        ctx.lineTo(sX + 20 * sS - earWiggle, sY - 100 * sS);
        ctx.lineTo(sX + 5 * sS, sY - 78 * sS);
        ctx.fill();
        
        // Eyes - GLOWING RED
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(sX - 7 * sS, sY - 68 * sS, 4 * sS, 0, Math.PI * 2);
        ctx.arc(sX + 7 * sS, sY - 68 * sS, 4 * sS, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Rust markings (Doberman)
        ctx.fillStyle = '#8B4513';
        ctx.globalAlpha = 0.5;
        // Muzzle
        ctx.beginPath();
        ctx.ellipse(sX, sY - 65 * sS, 8 * sS, 6 * sS, 0, 0, Math.PI * 2);
        ctx.fill();
        // Eyebrows
        ctx.beginPath();
        ctx.ellipse(sX - 8 * sS, sY - 78 * sS, 4 * sS, 2 * sS, 0.5, 0, Math.PI * 2);
        ctx.ellipse(sX + 8 * sS, sY - 78 * sS, 4 * sS, 2 * sS, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        
        // Legs (running)
        ctx.fillStyle = '#1a1a1a';
        const sLegSwing = Math.sin(sable.animFrame * 2.5) * 20 * sS;
        ctx.fillRect(sX - 18 * sS, sY - 10 * sS, 12 * sS, 25 * sS + sLegSwing);
        ctx.fillRect(sX + 6 * sS, sY - 10 * sS, 12 * sS, 25 * sS - sLegSwing);
        
        // Paws
        ctx.fillStyle = '#2d2d2d';
        ctx.beginPath();
        ctx.ellipse(sX - 12 * sS, sY + 18 * sS + sLegSwing, 8 * sS, 5 * sS, 0, 0, Math.PI * 2);
        ctx.ellipse(sX + 12 * sS, sY + 18 * sS - sLegSwing, 8 * sS, 5 * sS, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Tail
        ctx.fillStyle = '#1a1a1a';
        const tailWag = Math.sin(sable.animFrame * 4) * 10;
        ctx.beginPath();
        ctx.moveTo(sX - 25 * sS, sY - 30 * sS);
        ctx.quadraticCurveTo(sX - 45 * sS + tailWag, sY - 50 * sS, sX - 35 * sS + tailWag, sY - 70 * sS);
        ctx.lineTo(sX - 20 * sS, sY - 35 * sS);
        ctx.fill();
        
        // White heart patch on chest
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        const hx = sX, hy = sY - 35 * sS;
        ctx.moveTo(hx, hy + 3 * sS);
        ctx.bezierCurveTo(hx - 6 * sS, hy - 3 * sS, hx - 6 * sS, hy - 6 * sS, hx - 3 * sS, hy - 5 * sS);
        ctx.bezierCurveTo(hx, hy - 4 * sS, hx, hy - 4 * sS, hx + 3 * sS, hy - 5 * sS);
        ctx.bezierCurveTo(hx + 6 * sS, hy - 6 * sS, hx + 6 * sS, hy - 3 * sS, hx, hy + 3 * sS);
        ctx.fill();
        
        // Drool when chasing
        if (sable.state === 'chase') {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            const droolY = sY - 60 * sS + Math.sin(Date.now() / 150) * 3;
            ctx.beginPath();
            ctx.arc(sX + 5 * sS, droolY, 3 * sS, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Name label
        ctx.fillStyle = '#ff0000';
        ctx.font = `bold ${11 * sS}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('SABLE', sX, sY - 110 * sS);
    }
    
    // ==================== PLAYER (Norm) ====================
    const pZ = player.z;
    const pY = getScreenY(pZ) - player.jumpY;
    const pX = getLaneX(player.lane, pZ);
    const pS = getScale(pZ);
    
    // Shadow (stays on ground when jumping)
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(pX, getScreenY(pZ) + 5, 25 * pS, 8 * pS, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Norm body
    const normBounce = player.jumping ? 0 : Math.sin(player.animFrame * 2) * 4 * pS;
    const bodyY = pY - 30 * pS + normBounce;
    
    // Tan security shirt
    ctx.fillStyle = '#d4a574';
    const shirtH = player.sliding ? 25 * pS : 40 * pS;
    ctx.beginPath();
    ctx.ellipse(pX, bodyY, 18 * pS, shirtH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Navy pants
    ctx.fillStyle = '#1e3a5f';
    const pantH = player.sliding ? 12 * pS : 22 * pS;
    const pantY = player.sliding ? bodyY + 15 * pS : bodyY + 18 * pS;
    ctx.fillRect(pX - 10 * pS, pantY, 8 * pS, pantH);
    ctx.fillRect(pX + 2 * pS, pantY, 8 * pS, pantH);
    
    // Head
    ctx.fillStyle = '#fca5a5';
    const headY = bodyY - 35 * pS;
    ctx.beginPath();
    ctx.arc(pX, headY, 14 * pS, 0, Math.PI * 2);
    ctx.fill();
    
    // Hair
    ctx.fillStyle = '#d4a574';
    ctx.beginPath();
    ctx.arc(pX, headY - 5 * pS, 13 * pS, Math.PI, 0);
    ctx.fill();
    
    // Mustache (big bushy)
    ctx.fillStyle = '#4a3728';
    ctx.beginPath();
    ctx.ellipse(pX, headY + 3 * pS, 10 * pS, 4 * pS, 0, 0, Math.PI * 2);
    ctx.fill();
    // Mustache ends
    ctx.beginPath();
    ctx.ellipse(pX - 10 * pS, headY + 2 * pS, 4 * pS, 3 * pS, 0.3, 0, Math.PI * 2);
    ctx.ellipse(pX + 10 * pS, headY + 2 * pS, 4 * pS, 3 * pS, -0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // Eyes (determined)
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(pX - 5 * pS, headY - 2 * pS, 2.5 * pS, 0, Math.PI * 2);
    ctx.arc(pX + 5 * pS, headY - 2 * pS, 2.5 * pS, 0, Math.PI * 2);
    ctx.fill();
    
    // Security badge
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(pX - 4 * pS, bodyY - 5 * pS, 8 * pS, 10 * pS);
    ctx.fillStyle = '#000';
    ctx.font = `bold ${7 * pS}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('N', pX, bodyY + 1 * pS);
    
    // Fanny pack
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(pX - 12 * pS, bodyY + 8 * pS, 24 * pS, 10 * pS);
    
    // Arms
    ctx.fillStyle = '#d4a574';
    if (player.sliding) {
        // Arms forward when sliding
        ctx.fillRect(pX - 22 * pS, bodyY + 5 * pS, 18 * pS, 8 * pS);
        ctx.fillRect(pX + 4 * pS, bodyY + 5 * pS, 18 * pS, 8 * pS);
    } else {
        const armSwing = Math.sin(player.animFrame * 2) * 12 * pS;
        ctx.fillRect(pX - 22 * pS, bodyY - 5 * pS + armSwing, 7 * pS, 20 * pS);
        ctx.fillRect(pX + 15 * pS, bodyY - 5 * pS - armSwing, 7 * pS, 20 * pS);
    }
    
    // Stun effect
    if (player.stunTimer > 0) {
        ctx.fillStyle = 'rgba(255,0,0,0.2)';
        ctx.beginPath();
        ctx.arc(pX, headY - 20 * pS, 25 * pS, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ff0000';
        ctx.font = `bold ${14 * pS}px sans-serif`;
        ctx.fillText('!', pX, headY - 30 * pS);
    }
    
    // Flash effect (whiteout)
    if (player.flashTimer > 0) {
        ctx.fillStyle = `rgba(255,255,255,${player.flashTimer / 1200})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Push effect (blue tint)
    if (player.pushTimer > 0) {
        ctx.fillStyle = `rgba(0,212,255,${player.pushTimer / 800 * 0.3})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Tutorial hints
    if (runTime < 3000 && !runner.caught) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.roundRect(canvas.width / 2 - 140, 20, 280, 50, 10);
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('↑ Jump  ↓ Slide  ← → Switch lanes', canvas.width / 2, 40);
        ctx.fillText('Catch the runner!', canvas.width / 2, 58);
    }
    
    ctx.restore(); // End screen shake
}

// ==================== GAME LOOP ====================
function gameLoop(timestamp) {
    const dt = Math.min(timestamp - lastTime, 50); // Cap dt
    lastTime = timestamp;
    
    if (gameState === STATE.PLAYING) {
        update(dt);
        draw();
        requestAnimationFrame(gameLoop);
    } else if (gameState === STATE.PAUSED) {
        draw(); // Keep drawing frozen frame
    }
}

// ==================== INIT ====================
// Draw menu background
function menuDraw() {
    if (gameState !== STATE.MENU) return;
    
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Animated background
    const time = Date.now() / 1000;
    
    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGrad.addColorStop(0, '#0a0a2e');
    skyGrad.addColorStop(1, '#1a1a4e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Moving ground lines (decorative)
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
        const y = canvas.height * 0.5 + i * 40 + (time * 20) % 40;
        if (y < canvas.height) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }
    
    requestAnimationFrame(menuDraw);
}

// Start
gameState = STATE.MENU;
lastTime = performance.now();
menuDraw();
