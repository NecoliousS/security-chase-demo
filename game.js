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
// Z = 0 is HORIZON (far away), Z = 1 is CAMERA (close)
// Everything moves toward Z=1 (camera) as we run forward
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

// Get screen Y for depth Z (0 = horizon, 1 = bottom)
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
// Norm is at Z=0.75 (visible, running away from camera into screen)
const player = {
    lane: 0,
    targetLane: 0,
    z: 0.75,           // Fixed position on screen
    jumping: false,
    jumpY: 0,          // Visual jump offset
    jumpVel: 0,
    sliding: false,
    slideTimer: 0,
    stunTimer: 0,      // Stunned after hitting obstacle
    animFrame: 0
};

// ==================== RUNNER (Ahead of Norm) ====================
// Runner starts at Z=0.2 (near horizon, far away)
// Norm catches up over time (runner Z increases toward player Z)
const runner = {
    lane: 0,
    targetLane: 0,
    z: 0.15,           // Starts far away (near horizon)
    caught: false,
    escaped: false,
    abilityTimer: 0,
    lastAbility: 0,
    animFrame: 0,
    data: null,
    name: ""
};

// ==================== SABLE (Security Guard Style) ====================
// Sable is BEHIND Norm (Z > player.z)
// Appears when Norm hits obstacle, catches him if he hits another while stunned
const sable = {
    active: false,     // Only appears after first hit
    z: 0.9,            // Behind player
    lane: 0,
    state: "hidden",   // hidden, approaching, chasing, catch
    approachTimer: 0,  // Time to catch up after first hit
    stunGrace: 0,      // Grace period after hit
    animFrame: 0
};

// ==================== WORLD ====================
let obstacles = [];
let groundLines = [];
let particles = [];
let score = 0;
let distance = 0;      // Total distance run
let catchDistance = 0; // Distance to runner (starts high, decreases)
let gameSpeed = 0;
let baseSpeed = 15;
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
    
    // Reset player
    player.lane = 0;
    player.targetLane = 0;
    player.z = 0.75;
    player.jumping = false;
    player.jumpY = 0;
    player.jumpVel = 0;
    player.sliding = false;
    player.slideTimer = 0;
    player.stunTimer = 0;
    player.animFrame = 0;
    
    // Reset runner — starts FAR away (near horizon)
    runner.lane = Math.floor(Math.random() * 3) - 1;
    runner.targetLane = runner.lane;
    runner.z = 0.12;           // Near horizon
    runner.caught = false;
    runner.escaped = false;
    runner.abilityTimer = 0;
    runner.lastAbility = 0;
    runner.animFrame = 0;
    runner.data = currentRunner;
    runner.name = currentRunner.name;
    
    // Distance to catch starts high
    catchDistance = 100 + Math.random() * 50; // 100-150 meters to catch
    
    // Reset Sable
    sable.active = false;
    sable.z = 0.95;
    sable.lane = 0;
    sable.state = 'hidden';
    sable.approachTimer = 0;
    sable.stunGrace = 0;
    sable.animFrame = 0;
    
    // Ground lines
    for (let i = 0; i < 20; i++) {
        groundLines.push({ z: i * 0.05 });
    }
    
    // UI
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
    const tooClose = obstacles.some(o => o.lane === lane && o.z > 0.85);
    if (tooClose) return;
    
    const roll = Math.random();
    let type = 'crate';
    if (roll > 0.5) type = 'barrier';
    if (roll > 0.82) type = 'traincar';
    
    obstacles.push({
        lane: lane,
        z: 1.3,        // Spawn beyond camera
        type: type,
        hit: false,
        pixelated: false
    });
}

// ==================== HIT HANDLING ====================
function hitObstacle(o) {
    o.hit = true;
    player.stunTimer = 500;  // Brief stun
    
    // Create sparks
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
    
    // SABLE MECHANIC: If Sable is already active, she catches you
    // If not, she activates and starts approaching
    if (sable.active) {
        if (sable.state === 'chasing') {
            // Already chasing — catch!
            endGame(false, 'sable');
        }
    } else {
        // First hit — activate Sable
        sable.active = true;
        sable.state = 'approaching';
        sable.lane = player.lane;
        sable.approachTimer = 3000;  // 3 seconds to recover before she catches up
        sable.z = 0.95;  // Far behind
    }
}

// ==================== UPDATE ====================
let lastTime = 0;
let spawnTimer = 0;

function update(dt) {
    if (gameState !== STATE.PLAYING) return;
    
    const secs = dt / 1000;
    runTime += dt;
    
    // Speed increases slightly over time
    gameSpeed = baseSpeed + Math.min(5, runTime / 8000);
    
    // Distance
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
    
    // Runner AI — runner moves away but slower than Norm
    runner.lane += (runner.targetLane - runner.lane) * 0.08;
    
    // Runner lane switching
    if (Math.random() < 0.006) {
        const newLane = Math.floor(Math.random() * 3) - 1;
        if (Math.abs(newLane - runner.lane) <= 1) runner.targetLane = newLane;
    }
    
    // Runner abilities
    if (catchDistance < 60 && runTime - runner.lastAbility > 4000) {
        runner.lastAbility = runTime;
        useRunnerAbility();
    }
    
    // CATCH MECHANIC: Runner Z increases (gets closer to camera) as Norm catches up
    // But runner also moves forward, so it's a race
    const catchRate = 2.5;  // meters per second Norm gains
    catchDistance -= catchRate * secs;
    
    // Convert catchDistance to runner Z position (0.12 to 0.65)
    // 150m = z=0.12, 0m = z=0.65 (just ahead of player at 0.75)
    runner.z = 0.12 + (1 - catchDistance / 150) * 0.53;
    if (runner.z > 0.65) runner.z = 0.65;
    
    // Check catch
    if (catchDistance <= 0 && !runner.caught && !runner.escaped) {
        runner.caught = true;
        score += 500;
        showCatch();
        setTimeout(() => spawnNewRunner(), 2000);
    }
    
    // Check escape (runner gets too far)
    if (catchDistance > 200 && !runner.caught && !runner.escaped) {
        runner.escaped = true;
        endGame(false, 'escape');
    }
    
    // SABLE UPDATE
    if (sable.active) {
        sable.lane += (player.lane - sable.lane) * 0.1;
        sable.animFrame += dt * 0.01;
        
        if (sable.state === 'approaching') {
            // Sable catches up over approachTimer
            sable.approachTimer -= dt;
            const progress = 1 - (sable.approachTimer / 3000);
            sable.z = 0.95 - progress * 0.15;  // Moves from 0.95 to 0.80
            
            if (sable.approachTimer <= 0) {
                sable.state = 'chasing';
                sable.z = 0.82;  // Right behind player
            }
        } else if (sable.state === 'chasing') {
            // Sable stays right behind, catches if player stuns again
            sable.z = 0.82 + Math.sin(runTime / 200) * 0.02;
            
            // If player hits obstacle while Sable is chasing, caught!
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
    
    // Update obstacles (move toward camera / player)
    obstacles = obstacles.filter(o => {
        o.z -= gameSpeed * secs * 0.1;  // Move toward player
        
        // Collision when obstacle reaches player's Z
        if (o.z < player.z + 0.05 && o.z > player.z - 0.05 && !o.hit) {
            const laneDiff = Math.abs(o.lane - player.lane);
            if (laneDiff < 0.5) {
                // Same lane — check action
                if (o.type === 'crate' && !player.jumping) {
                    hitObstacle(o);
                } else if (o.type === 'barrier' && !player.sliding) {
                    hitObstacle(o);
                } else if (o.type === 'traincar') {
                    hitObstacle(o);
                }
            }
        }
        
        return o.z > -0.2;
    });
    
    // Update ground lines
    groundLines.forEach(l => {
        l.z -= gameSpeed * secs * 0.1;
        if (l.z < 0) l.z += 1;
    });
    
    // Update particles
    particles = particles.filter(p => {
        p.life -= dt;
        p.z -= gameSpeed * secs * 0.1;
        return p.life > 0;
    });
    
    // Animations
    player.animFrame += dt * 0.012;
    runner.animFrame += dt * 0.015;
    
    // Update distance bar
    const distFill = Math.max(0, Math.min(100, (1 - catchDistance / 150) * 100));
    document.getElementById('distanceFill').style.width = distFill + '%';
    document.getElementById('distanceText').textContent = Math.max(0, Math.floor(catchDistance)) + 'm to catch';
    
    // Score
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
            catchDistance += 30;  // Runner gets away
            createFlash();
            break;
            
        case 'pixel':
            obstacles.forEach(o => {
                if (o.z > runner.z && o.z < runner.z + 0.4) o.pixelated = true;
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
    runner.z = 0.12;
    runner.caught = false;
    runner.escaped = false;
    runner.lastAbility = runTime;
    catchDistance = 100 + Math.random() * 50;
    
    // Reset Sable
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
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            z: 0,
            type: 'flash',
            life: 300,
            size: 60 + Math.random() * 80
        });
    }
}

function createShockwave(x, z) {
    particles.push({
        x: x, z: z,
        type: 'shockwave',
        life: 500,
        radius: 5,
        maxRadius: 60
    });
}

function createZipEffect() {
    for (let i = 0; i < 6; i++) {
        particles.push({
            x: getLaneX(runner.lane, runner.z),
            z: runner.z,
            type: 'zip',
            life: 300,
            angle: (Math.PI * 2 / 6) * i
        });
    }
}

// ==================== DRAWING ====================
function draw() {
    // Clear
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // ==================== SKY ====================
    const skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
    skyGrad.addColorStop(0, '#0a0a2e');
    skyGrad.addColorStop(0.5, '#1a1a4e');
    skyGrad.addColorStop(1, '#2d2d6e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, HORIZON_Y);
    
    // Stars
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 50; i++) {
        const sx = (i * 137.5 + distance * 0.02) % canvas.width;
        const sy = (i * 71.3) % (HORIZON_Y * 0.8);
        ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 1000 + i) * 0.3;
        ctx.beginPath();
        ctx.arc(sx, sy, 1 + (i % 2), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    
    // Moon
    ctx.fillStyle = '#fffde7';
    ctx.beginPath();
    ctx.arc(canvas.width * 0.8, HORIZON_Y * 0.25, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0a2e';
    ctx.beginPath();
    ctx.arc(canvas.width * 0.8 + 8, HORIZON_Y * 0.25 - 4, 18, 0, Math.PI * 2);
    ctx.fill();
    
    // ==================== GROUND (Train Yard) ====================
    const groundGrad = ctx.createLinearGradient(0, HORIZON_Y, 0, canvas.height);
    groundGrad.addColorStop(0, '#3d3425');
    groundGrad.addColorStop(0.3, '#4a3f2f');
    groundGrad.addColorStop(1, '#2d261e');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, HORIZON_Y, canvas.width, canvas.height - HORIZON_Y);
    
    // Perspective lines (railroad ties)
    ctx.strokeStyle = '#5c4d3c';
    ctx.lineWidth = 2;
    groundLines.forEach(l => {
        const y = getScreenY(l.z);
        const widthAtZ = ROAD_WIDTH * (0.2 + 0.8 * l.z);
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2 - widthAtZ / 2, y);
        ctx.lineTo(canvas.width / 2 + widthAtZ / 2, y);
        ctx.stroke();
    });
    
    // Rail tracks (3 lanes)
    ctx.strokeStyle = '#718096';
    ctx.lineWidth = 3;
    for (let lane = -1; lane <= 1; lane++) {
        const xTop = getLaneX(lane, 0);
        const xBot = getLaneX(lane, 1);
        ctx.beginPath();
        ctx.moveTo(xTop, HORIZON_Y);
        ctx.lineTo(xBot, canvas.height);
        ctx.stroke();
    }
    
    // Gravel
    ctx.fillStyle = '#3d3425';
    for (let i = 0; i < 40; i++) {
        const gz = (i * 0.025 + distance * 0.001) % 1;
        const gy = getScreenY(gz);
        const gx = (i * 53) % canvas.width;
        ctx.fillRect(gx, gy, 3, 2);
    }
    
    // ==================== OBSTACLES ====================
    // Sort by Z so far ones draw first
    obstacles.sort((a, b) => a.z - b.z);
    
    obstacles.forEach(o => {
        const y = getScreenY(o.z);
        const s = getScale(o.z);
        const x = getLaneX(o.lane, o.z);
        
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(x, y + 5, 25 * s, 7 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        
        if (o.type === 'crate') {
            // Crate — jump over
            ctx.fillStyle = '#8B4513';
            const h = 45 * s, w = 50 * s;
            ctx.fillRect(x - w / 2, y - h, w, h);
            
            ctx.fillStyle = '#A0522D';
            ctx.fillRect(x - w / 2 + 2, y - h + 2, w - 4, h / 3);
            ctx.fillRect(x - w / 2 + 2, y - h / 2, w - 4, h / 3);
            
            // Warning
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.moveTo(x, y - h + 6);
            ctx.lineTo(x + 6, y - h + 16);
            ctx.lineTo(x - 6, y - h + 16);
            ctx.fill();
            
        } else if (o.type === 'barrier') {
            // Barrier — slide under
            ctx.fillStyle = '#FF6B35';
            const barH = 30 * s, barW = 65 * s;
            const barY = y - 90 * s;
            ctx.fillRect(x - barW / 2, barY, barW, barH);
            
            ctx.fillStyle = '#FFD700';
            for (let i = 0; i < 3; i++) {
                ctx.fillRect(x - barW / 2 + i * 22 * s, barY, 7 * s, barH);
            }
            
            ctx.fillStyle = '#718096';
            ctx.fillRect(x - barW / 2 + 4, barY + barH, 5 * s, 90 * s);
            ctx.fillRect(x + barW / 2 - 12, barY + barH, 5 * s, 90 * s);
            
        } else if (o.type === 'traincar') {
            // Train car — dodge
            ctx.fillStyle = '#2d3748';
            const carW = 85 * s, carH = 65 * s;
            ctx.fillRect(x - carW / 2, y - carH, carW, carH);
            
            ctx.fillStyle = '#1a202c';
            ctx.fillRect(x - carW / 2 + 6, y - carH + 8, carW - 12, 22 * s);
            
            ctx.fillStyle = '#e94560';
            ctx.font = `bold ${10 * s}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.save();
            ctx.translate(x, y - carH / 2);
            ctx.rotate(-0.1);
            ctx.fillText('VANDALS', 0, 0);
            ctx.restore();
        }
        
        if (o.pixelated) {
            ctx.fillStyle = 'rgba(0,255,0,0.15)';
            ctx.fillRect(x - 35 * s, y - 55 * s, 70 * s, 60 * s);
        }
    });
    
    // ==================== PARTICLES ====================
    particles.forEach(p => {
        const y = p.y || getScreenY(p.z);
        const s = getScale(p.z);
        
        if (p.type === 'paint') {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life / 3000;
            ctx.beginPath();
            ctx.arc(p.x, y, 30 * s, 0, Math.PI * 2);
            ctx.fill();
            
        } else if (p.type === 'spark') {
            ctx.fillStyle = '#ffd700';
            ctx.globalAlpha = p.life / 400;
            ctx.beginPath();
            ctx.arc(p.x + p.vx * (400 - p.life) / 10, p.y + p.vy * (400 - p.life) / 10, 3, 0, Math.PI * 2);
            ctx.fill();
            
        } else if (p.type === 'flash') {
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = p.life / 300;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            
        } else if (p.type === 'shockwave') {
            ctx.strokeStyle = '#00d4ff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = p.life / 500;
            p.radius += 1;
            ctx.beginPath();
            ctx.arc(p.x, y, p.radius * s, 0, Math.PI * 2);
            ctx.stroke();
            
        } else if (p.type === 'zip') {
            ctx.fillStyle = '#00d4ff';
            ctx.globalAlpha = p.life / 300;
            const zx = p.x + Math.cos(p.angle + Date.now() / 200) * 25 * s;
            const zy = y + Math.sin(p.angle + Date.now() / 200) * 15 * s;
            ctx.beginPath();
            ctx.arc(zx, zy, 4 * s, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    ctx.globalAlpha = 1;
    
    // ==================== RUNNER (Ahead of Norm) ====================
    if (!runner.caught && !runner.escaped) {
        const rZ = runner.z;
        const rY = getScreenY(rZ);
        const rX = getLaneX(runner.lane, rZ);
        const rS = getScale(rZ);
        
        // Only draw if visible (not too close to horizon)
        if (rZ > 0.05) {
            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.beginPath();
            ctx.ellipse(rX, rY + 3, 18 * rS, 5 * rS, 0, 0, Math.PI * 2);
            ctx.fill();
            
            const bounce = Math.sin(runner.animFrame * 2) * 4 * rS;
            const bodyY = rY - 25 * rS + bounce;
            
            if (runner.data.faction === 'vandal') {
                // Hoodie
                ctx.fillStyle = runner.data.color;
                ctx.beginPath();
                ctx.ellipse(rX, bodyY, 13 * rS, 17 * rS, 0, 0, Math.PI * 2);
                ctx.fill();
                
                // Head
                ctx.fillStyle = '#fca5a5';
                ctx.beginPath();
                ctx.arc(rX, bodyY - 22 * rS, 10 * rS, 0, Math.PI * 2);
                ctx.fill();
                
                // Hood
                ctx.fillStyle = runner.data.accent;
                ctx.beginPath();
                ctx.arc(rX, bodyY - 24 * rS, 11 * rS, Math.PI, 0);
                ctx.fill();
                
            } else {
                // Tech suit
                ctx.fillStyle = runner.data.color;
                ctx.beginPath();
                ctx.ellipse(rX, bodyY, 12 * rS, 16 * rS, 0, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.strokeStyle = runner.data.accent;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(rX - 10 * rS, bodyY - 8 * rS);
                ctx.lineTo(rX + 10 * rS, bodyY - 8 * rS);
                ctx.stroke();
                
                ctx.fillStyle = '#1e293b';
                ctx.beginPath();
                ctx.arc(rX, bodyY - 20 * rS, 9 * rS, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = runner.data.accent;
                ctx.fillRect(rX - 8 * rS, bodyY - 22 * rS, 16 * rS, 4 * rS);
            }
            
            // Legs
            ctx.fillStyle = runner.data.faction === 'vandal' ? '#374151' : '#0f172a';
            const swing = Math.sin(runner.animFrame * 2.5) * 12 * rS;
            ctx.fillRect(rX - 7 * rS, bodyY + 12 * rS, 5 * rS, 14 * rS + swing);
            ctx.fillRect(rX + 2 * rS, bodyY + 12 * rS, 5 * rS, 14 * rS - swing);
            
            // Name
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${8 * rS}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(runner.name, rX, bodyY - 35 * rS);
        }
    }
    
    // ==================== SABLE (Behind Player) ====================
    if (sable.active && sable.state !== 'hidden') {
        const sZ = sable.z;
        const sY = getScreenY(sZ);
        const sX = getLaneX(sable.lane, sZ);
        const sS = getScale(sZ);
        
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(sX, sY + 5, 30 * sS, 8 * sS, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Body
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.ellipse(sX, sY - 22 * sS, 25 * sS, 24 * sS, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Chest
        ctx.beginPath();
        ctx.ellipse(sX, sY - 35 * sS, 18 * sS, 16 * sS, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Head
        ctx.beginPath();
        ctx.ellipse(sX, sY - 55 * sS, 15 * sS, 14 * sS, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Snout
        ctx.fillStyle = '#2d2d2d';
        ctx.beginPath();
        ctx.ellipse(sX, sY - 62 * sS, 10 * sS, 8 * sS, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Ears
        ctx.fillStyle = '#1a1a1a';
        const earWiggle = Math.sin(sable.animFrame * 3) * 3;
        ctx.beginPath();
        ctx.moveTo(sX - 12 * sS, sY - 65 * sS);
        ctx.lineTo(sX - 16 * sS + earWiggle, sY - 85 * sS);
        ctx.lineTo(sX - 4 * sS, sY - 68 * sS);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(sX + 12 * sS, sY - 65 * sS);
        ctx.lineTo(sX + 16 * sS - earWiggle, sY - 85 * sS);
        ctx.lineTo(sX + 4 * sS, sY - 68 * sS);
        ctx.fill();
        
        // GLOWING RED EYES
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(sX - 6 * sS, sY - 58 * sS, 3.5 * sS, 0, Math.PI * 2);
        ctx.arc(sX + 6 * sS, sY - 58 * sS, 3.5 * sS, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Rust markings
        ctx.fillStyle = '#8B4513';
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.ellipse(sX, sY - 52 * sS, 7 * sS, 5 * sS, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        
        // White heart patch
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        const hx = sX, hy = sY - 30 * sS;
        ctx.moveTo(hx, hy + 2 * sS);
        ctx.bezierCurveTo(hx - 5 * sS, hy - 3 * sS, hx - 5 * sS, hy - 5 * sS, hx - 2 * sS, hy - 4 * sS);
        ctx.bezierCurveTo(hx, hy - 3 * sS, hx, hy - 3 * sS, hx + 2 * sS, hy - 4 * sS);
        ctx.bezierCurveTo(hx + 5 * sS, hy - 5 * sS, hx + 5 * sS, hy - 3 * sS, hx, hy + 2 * sS);
        ctx.fill();
        
        // Legs
        ctx.fillStyle = '#1a1a1a';
        const sLegSwing = Math.sin(sable.animFrame * 2.5) * 18 * sS;
        ctx.fillRect(sX - 15 * sS, sY - 8 * sS, 10 * sS, 22 * sS + sLegSwing);
        ctx.fillRect(sX + 5 * sS, sY - 8 * sS, 10 * sS, 22 * sS - sLegSwing);
        
        // Paws
        ctx.fillStyle = '#2d2d2d';
        ctx.beginPath();
        ctx.ellipse(sX - 10 * sS, sY + 16 * sS + sLegSwing, 7 * sS, 4 * sS, 0, 0, Math.PI * 2);
        ctx.ellipse(sX + 10 * sS, sY + 16 * sS - sLegSwing, 7 * sS, 4 * sS, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Tail
        ctx.fillStyle = '#1a1a1a';
        const tailWag = Math.sin(sable.animFrame * 4) * 8;
        ctx.beginPath();
        ctx.moveTo(sX - 20 * sS, sY - 25 * sS);
        ctx.quadraticCurveTo(sX - 38 * sS + tailWag, sY - 40 * sS, sX - 30 * sS + tailWag, sY - 58 * sS);
        ctx.lineTo(sX - 15 * sS, sY - 30 * sS);
        ctx.fill();
        
        // Drool
        if (sable.state === 'chasing') {
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath();
            ctx.arc(sX + 4 * sS, sY - 50 * sS + Math.sin(Date.now() / 150) * 2, 2.5 * sS, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Name
        ctx.fillStyle = '#ff0000';
        ctx.font = `bold ${10 * sS}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('SABLE', sX, sY - 95 * sS);
        
        // Warning indicator when approaching
        if (sable.state === 'approaching') {
            ctx.fillStyle = 'rgba(255,0,0,0.3)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = '#ff0000';
            ctx.font = 'bold 20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('SABLE IS COMING!', canvas.width / 2, canvas.height / 2);
        }
    }
    
    // ==================== PLAYER (Norm) ====================
    const pZ = player.z;
    const pY = getScreenY(pZ) - player.jumpY;
    const pX = getLaneX(player.lane, pZ);
    const pS = getScale(pZ);
    
    // Shadow on ground
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(pX, getScreenY(pZ) + 5, 22 * pS, 7 * pS, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Body
    const bounce = player.jumping ? 0 : Math.sin(player.animFrame * 2) * 3 * pS;
    const bodyY = pY - 28 * pS + bounce;
    
    // Tan shirt
    ctx.fillStyle = '#d4a574';
    const shirtH = player.sliding ? 22 * pS : 38 * pS;
    ctx.beginPath();
    ctx.ellipse(pX, bodyY, 16 * pS, shirtH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Navy pants
    ctx.fillStyle = '#1e3a5f';
    const pantH = player.sliding ? 10 * pS : 20 * pS;
    const pantY = player.sliding ? bodyY + 12 * pS : bodyY + 16 * pS;
    ctx.fillRect(pX - 9 * pS, pantY, 7 * pS, pantH);
    ctx.fillRect(pX + 2 * pS, pantY, 7 * pS, pantH);
    
    // Head
    ctx.fillStyle = '#fca5a5';
    const headY = bodyY - 32 * pS;
    ctx.beginPath();
    ctx.arc(pX, headY, 13 * pS, 0, Math.PI * 2);
    ctx.fill();
    
    // Hair
    ctx.fillStyle = '#d4a574';
    ctx.beginPath();
    ctx.arc(pX, headY - 4 * pS, 12 * pS, Math.PI, 0);
    ctx.fill();
    
    // Big bushy mustache
    ctx.fillStyle = '#4a3728';
    ctx.beginPath();
    ctx.ellipse(pX, headY + 2 * pS, 9 * pS, 3.5 * pS, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ends curled up
    ctx.beginPath();
    ctx.ellipse(pX - 9 * pS, headY + 1 * pS, 3.5 * pS, 2.5 * pS, 0.4, 0, Math.PI * 2);
    ctx.ellipse(pX + 9 * pS, headY + 1 * pS, 3.5 * pS, 2.5 * pS, -0.4, 0, Math.PI * 2);
    ctx.fill();
    
    // Eyes
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(pX - 4.5 * pS, headY - 2 * pS, 2.2 * pS, 0, Math.PI * 2);
    ctx.arc(pX + 4.5 * pS, headY - 2 * pS, 2.2 * pS, 0, Math.PI * 2);
    ctx.fill();
    
    // Security badge
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(pX - 3.5 * pS, bodyY - 4 * pS, 7 * pS, 9 * pS);
    ctx.fillStyle = '#000';
    ctx.font = `bold ${6 * pS}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('N', pX, bodyY + 1 * pS);
    
    // Fanny pack
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(pX - 11 * pS, bodyY + 6 * pS, 22 * pS, 9 * pS);
    
    // Arms
    ctx.fillStyle = '#d4a574';
    if (player.sliding) {
        ctx.fillRect(pX - 20 * pS, bodyY + 3 * pS, 16 * pS, 7 * pS);
        ctx.fillRect(pX + 4 * pS, bodyY + 3 * pS, 16 * pS, 7 * pS);
    } else {
        const armSwing = Math.sin(player.animFrame * 2) * 10 * pS;
        ctx.fillRect(pX - 20 * pS, bodyY - 4 * pS + armSwing, 6 * pS, 18 * pS);
        ctx.fillRect(pX + 14 * pS, bodyY - 4 * pS - armSwing, 6 * pS, 18 * pS);
    }
    
    // Stun effect
    if (player.stunTimer > 0) {
        ctx.fillStyle = 'rgba(255,0,0,0.15)';
        ctx.beginPath();
        ctx.arc(pX, headY - 18 * pS, 22 * pS, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ff0000';
        ctx.font = `bold ${12 * pS}px sans-serif`;
        ctx.fillText('!', pX, headY - 26 * pS);
    }
    
    // Tutorial
    if (runTime < 4000) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.beginPath();
        ctx.roundRect(canvas.width / 2 - 130, 20, 260, 45, 8);
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('↑ Jump  ↓ Slide  ← → Switch', canvas.width / 2, 38);
        ctx.fillText('Catch the runner! Avoid obstacles!', canvas.width / 2, 55);
    }
}

// ==================== GAME LOOP ====================
function gameLoop(timestamp) {
    const dt = Math.min(timestamp - lastTime, 50);
    lastTime = timestamp;
    
    if (gameState === STATE.PLAYING) {
        update(dt);
        draw();
        requestAnimationFrame(gameLoop);
    } else if (gameState === STATE.PAUSED) {
        draw();
    }
}

// ==================== MENU BACKGROUND ====================
function menuDraw() {
    if (gameState !== STATE.MENU) return;
    
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const time = Date.now() / 1000;
    
    // Sky
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0a0a2e');
    grad.addColorStop(1, '#1a1a4e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Moving lines
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 15; i++) {
        const y = canvas.height * 0.4 + i * 35 + (time * 30) % 35;
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
