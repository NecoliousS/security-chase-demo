// ==================== TRAIN YARD CHASE — NORM THE SECURITY GUARD ====================
// Camera is behind Norm, Norm runs INTO the screen
// Obstacles are STATIONARY in the world — Norm runs toward them
// Sable chases Norm when he messes up

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

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

// ==================== PERSPECTIVE ====================
let LANE_WIDTH = 0;
let ROAD_WIDTH = 0;
let HORIZON_Y = 0;
const VIEW_DISTANCE = 140; // meters ahead visible

function calcPerspective() {
    LANE_WIDTH = canvas.width * 0.22;
    ROAD_WIDTH = LANE_WIDTH * 3.8;
    HORIZON_Y = canvas.height * 0.25;
}
calcPerspective();
window.addEventListener('resize', calcPerspective);

function getLaneX(lane, z) {
    const center = canvas.width / 2;
    const spread = LANE_WIDTH * (0.25 + 0.75 * z);
    return center + lane * spread;
}

function getScreenY(z) {
    return HORIZON_Y + (canvas.height - HORIZON_Y) * z;
}

function getScale(z) {
    return 0.15 + 0.85 * z;
}

// Convert world distance ahead to screen Z
function worldToScreenZ(ahead) {
    // ahead: meters ahead of player. 0 = at player, VIEW_DISTANCE = horizon
    if (ahead > VIEW_DISTANCE) return -1;
    if (ahead < -30) return 2;
    return 0.72 * (1 - ahead / VIEW_DISTANCE);
}

// ==================== RUNNERS ====================
const ALL_RUNNERS = [
    { name: "Tag", faction: "vandal", diff: 1, hoodie: "#9ca3af", pants: "#4b5563", accent: "#6b7280", ability: "none" },
    { name: "Roller", faction: "vandal", diff: 2, hoodie: "#3b82f6", pants: "#1e3a8a", accent: "#fbbf24", ability: "paint" },
    { name: "Chrome", faction: "vandal", diff: 3, hoodie: "#c0c0c0", pants: "#374151", accent: "#ef4444", ability: "flash" },
    { name: "Pixel", faction: "datapunk", diff: 1, hoodie: "#1e293b", pants: "#0f172a", accent: "#4ade80", ability: "pixel" },
    { name: "Echo", faction: "datapunk", diff: 2, hoodie: "#581c87", pants: "#3b0764", accent: "#fbbf24", ability: "push" },
    { name: "Zip", faction: "datapunk", diff: 3, hoodie: "#0c4a6e", pants: "#082f49", accent: "#00d4ff", ability: "zip" }
];

let currentRunner = null;

function pickRandomRunner() {
    const roll = Math.random();
    let pool = roll < 0.4 ? ALL_RUNNERS.filter(r => r.diff === 1) :
               roll < 0.7 ? ALL_RUNNERS.filter(r => r.diff === 2) :
               ALL_RUNNERS.filter(r => r.diff === 3);
    return pool[Math.floor(Math.random() * pool.length)];
}

// ==================== PLAYER (Norm — Security Guard) ====================
const player = {
    lane: 0,
    targetLane: 0,
    worldZ: 0,      // Total distance run
    jumping: false,
    jumpY: 0,
    jumpVel: 0,
    sliding: false,
    slideTimer: 0,
    stunTimer: 0,
    animFrame: 0
};

// ==================== RUNNER AHEAD ====================
const runner = {
    lane: 0,
    targetLane: 0,
    worldZ: 0,      // Absolute world position
    caught: false,
    escaped: false,
    abilityTimer: 0,
    lastAbility: 0,
    animFrame: 0,
    data: null,
    name: ""
};

// ==================== SABLE (Security Doberman) ====================
const sable = {
    active: false,
    lane: 0,
    state: "hidden",
    approachTimer: 0,
    animFrame: 0
};

// ==================== WORLD ====================
let obstacles = [];
let sleepers = [];      // Train track wooden sleepers
let particles = [];
let score = 0;
let distance = 0;
let catchDistance = 0;  // Meters behind runner
let gameSpeed = 0;
let baseSpeed = 14;
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

// ==================== UI BUTTONS ====================
document.getElementById('playBtn').addEventListener('click', (e) => {
    e.preventDefault();
    startGame();
});

document.getElementById('infoBtn').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('infoScreen').style.display = 'flex';
});

document.getElementById('closeInfoBtn').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('infoScreen').style.display = 'none';
});

document.getElementById('pauseBtn').addEventListener('click', (e) => {
    e.preventDefault();
    pauseGame();
});

document.getElementById('resumeBtn').addEventListener('click', (e) => {
    e.preventDefault();
    resumeGame();
});

document.getElementById('menuBtn').addEventListener('click', (e) => {
    e.preventDefault();
    returnToMenu();
});

document.getElementById('retryBtn').addEventListener('click', (e) => {
    e.preventDefault();
    startGame();
});

document.getElementById('endMenuBtn').addEventListener('click', (e) => {
    e.preventDefault();
    returnToMenu();
});

// Mobile
document.getElementById('btnLeft').addEventListener('touchstart', (e) => { e.preventDefault(); moveLane(-1); });
document.getElementById('btnRight').addEventListener('touchstart', (e) => { e.preventDefault(); moveLane(1); });
document.getElementById('btnJump').addEventListener('touchstart', (e) => { e.preventDefault(); startJump(); });
document.getElementById('btnSlide').addEventListener('touchstart', (e) => { e.preventDefault(); startSlide(); });

function moveLane(dir) {
    if (player.stunTimer > 0) return;
    player.targetLane = Math.max(-1, Math.min(1, player.targetLane + dir));
}

function startJump() {
    if (player.jumping || player.sliding || player.stunTimer > 0) return;
    player.jumping = true;
    player.jumpVel = 18;
}

function startSlide() {
    if (player.jumping || player.sliding || player.stunTimer > 0) return;
    player.sliding = true;
    player.slideTimer = 700;
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
    sleepers = [];
    particles = [];
    
    player.lane = 0;
    player.targetLane = 0;
    player.worldZ = 0;
    player.jumping = false;
    player.jumpY = 0;
    player.jumpVel = 0;
    player.sliding = false;
    player.slideTimer = 0;
    player.stunTimer = 0;
    player.animFrame = 0;
    
    // Runner starts ahead
    runner.lane = Math.floor(Math.random() * 3) - 1;
    runner.targetLane = runner.lane;
    runner.worldZ = 60; // 60 meters ahead
    runner.caught = false;
    runner.escaped = false;
    runner.abilityTimer = 0;
    runner.lastAbility = 0;
    runner.animFrame = 0;
    runner.data = currentRunner;
    runner.name = currentRunner.name;
    
    catchDistance = runner.worldZ - player.worldZ;
    
    sable.active = false;
    sable.lane = 0;
    sable.state = 'hidden';
    sable.approachTimer = 0;
    sable.animFrame = 0;
    
    // Init sleepers every 4 meters
    for (let d = 0; d < VIEW_DISTANCE + 20; d += 4) {
        sleepers.push({ distance: d });
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

// ==================== SPAWN (Stationary Obstacles) ====================
function spawnObstacle() {
    const lane = Math.floor(Math.random() * 3) - 1;
    
    // Check not too close to existing in same lane
    const tooClose = obstacles.some(o => {
        if (o.lane !== lane) return false;
        const ahead = o.distance - player.worldZ;
        return ahead > 0 && ahead < 25;
    });
    if (tooClose) return;
    
    const roll = Math.random();
    let type = 'crate';
    if (roll > 0.5) type = 'barrier';
    if (roll > 0.82) type = 'traincar';
    
    // Place ahead of player at fixed world distance
    const spawnDist = player.worldZ + VIEW_DISTANCE + Math.random() * 20;
    
    obstacles.push({
        lane: lane,
        distance: spawnDist,
        type: type,
        hit: false,
        pixelated: false
    });
}

// ==================== HIT HANDLING ====================
function hitObstacle(o) {
    o.hit = true;
    player.stunTimer = 600;
    
    // Sparks
    const px = getLaneX(player.lane, 0.72);
    const py = getScreenY(0.72);
    for (let i = 0; i < 10; i++) {
        particles.push({
            x: px + (Math.random() - 0.5) * 50,
            y: py - 20,
            life: 500,
            vx: (Math.random() - 0.5) * 8,
            vy: -Math.random() * 6,
            type: 'spark',
            color: '#ffd700'
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
        sable.approachTimer = 2500;
    }
}

// ==================== UPDATE ====================
let lastTime = 0;
let spawnTimer = 0;

function update(dt) {
    if (gameState !== STATE.PLAYING) return;
    
    const secs = dt / 1000;
    runTime += dt;
    
    gameSpeed = baseSpeed + Math.min(6, runTime / 6000);
    player.worldZ += gameSpeed * secs * 8; // Run forward
    distance = Math.floor(player.worldZ);
    score += Math.floor(gameSpeed * secs);
    
    // Smooth lane
    player.lane += (player.targetLane - player.lane) * 0.14;
    
    // Player physics
    if (player.jumping) {
        player.jumpY += player.jumpVel;
        player.jumpVel -= 0.95;
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
    
    // Runner AI — runs ahead, occasionally switches lanes
    runner.lane += (runner.targetLane - runner.lane) * 0.07;
    if (Math.random() < 0.005) {
        const newLane = Math.floor(Math.random() * 3) - 1;
        if (Math.abs(newLane - runner.lane) <= 1) runner.targetLane = newLane;
    }
    
    // Runner moves forward slightly slower than Norm (Norm catches up)
    runner.worldZ += gameSpeed * secs * 6.5;
    
    // Catch mechanic
    catchDistance = runner.worldZ - player.worldZ;
    
    if (catchDistance <= 5 && !runner.caught && !runner.escaped) {
        runner.caught = true;
        score += 500;
        showCatch();
        setTimeout(() => spawnNewRunner(), 2000);
    }
    
    if (catchDistance > 200 && !runner.caught && !runner.escaped) {
        runner.escaped = true;
        endGame(false, 'escape');
    }
    
    // Runner abilities when Norm gets close
    if (catchDistance < 50 && runTime - runner.lastAbility > 3500 && !runner.caught) {
        runner.lastAbility = runTime;
        useRunnerAbility();
    }
    
    // SABLE
    if (sable.active) {
        sable.lane += (player.lane - sable.lane) * 0.12;
        sable.animFrame += dt * 0.012;
        
        if (sable.state === 'approaching') {
            sable.approachTimer -= dt;
            if (sable.approachTimer <= 0) {
                sable.state = 'chasing';
            }
        } else if (sable.state === 'chasing') {
            if (player.stunTimer > 0 && Math.abs(sable.lane - player.lane) < 0.5) {
                endGame(false, 'sable');
            }
        }
    }
    
    // Spawn obstacles
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
        spawnObstacle();
        spawnTimer = 800 + Math.random() * 1000;
    }
    
    // Update obstacles (stationary — only check collision and culling)
    obstacles = obstacles.filter(o => {
        const ahead = o.distance - player.worldZ;
        
        // Collision check when very close to player
        if (!o.hit && ahead < 8 && ahead > -3) {
            const laneDiff = Math.abs(o.lane - player.lane);
            if (laneDiff < 0.5) {
                if (o.type === 'crate' && !player.jumping) {
                    hitObstacle(o);
                } else if (o.type === 'barrier' && !player.sliding) {
                    hitObstacle(o);
                } else if (o.type === 'traincar') {
                    hitObstacle(o); // Must dodge — can't jump or slide
                }
            }
        }
        
        // Keep if within view (ahead or slightly behind)
        return ahead > -40 && ahead < VIEW_DISTANCE + 20;
    });
    
    // Update sleepers (infinite scroll)
    sleepers = sleepers.filter(s => (s.distance - player.worldZ) > -20);
    while (sleepers.length < 50) {
        const lastDist = sleepers.length > 0 ? sleepers[sleepers.length - 1].distance : player.worldZ;
        sleepers.push({ distance: lastDist + 4 });
    }
    
    // Particles
    particles = particles.filter(p => {
        p.life -= dt;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        return p.life > 0;
    });
    
    player.animFrame += dt * 0.014;
    runner.animFrame += dt * 0.016;
    
    // UI
    const distFill = Math.max(0, Math.min(100, (1 - catchDistance / 100) * 100));
    document.getElementById('distanceFill').style.width = distFill + '%';
    document.getElementById('distanceText').textContent = Math.max(0, Math.floor(catchDistance)) + 'm to catch';
    document.getElementById('scoreBox').textContent = '$' + score;
}

function useRunnerAbility() {
    const ability = runner.data.ability;
    switch(ability) {
        case 'paint':
            for (let i = 0; i < 5; i++) {
                particles.push({
                    x: getLaneX(runner.lane, worldToScreenZ(catchDistance)) + (Math.random()-0.5)*40,
                    y: getScreenY(worldToScreenZ(catchDistance)) - 30,
                    life: 2000,
                    vx: (Math.random()-0.5)*3,
                    vy: Math.random()*2,
                    type: 'paint',
                    color: runner.data.accent
                });
            }
            break;
        case 'flash':
            catchDistance += 25;
            runner.worldZ += 25;
            createFlash();
            break;
        case 'pixel':
            obstacles.forEach(o => {
                const ahead = o.distance - player.worldZ;
                if (ahead > 10 && ahead < 60) o.pixelated = true;
            });
            break;
        case 'push':
            catchDistance += 15;
            runner.worldZ += 15;
            createShockwave();
            break;
        case 'zip':
            catchDistance += 30;
            runner.worldZ += 30;
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
    runner.caught = false;
    runner.escaped = false;
    runner.lastAbility = runTime;
    catchDistance = 80 + Math.random() * 40;
    runner.worldZ = player.worldZ + catchDistance;
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
            title.textContent = 'SABLE GOT YOU!';
            msg.textContent = 'The Doberman caught you!';
        } else {
            title.textContent = 'ESCAPED!';
            msg.textContent = 'Target got away!';
        }
        title.className = 'lose-color';
        msg.style.color = '#f87171';
    }
    
    document.getElementById('endRunner').textContent = runner.name;
    document.getElementById('endDist').textContent = distance;
    document.getElementById('endScore').textContent = score;
    document.getElementById('hud').style.display = 'none';
    document.getElementById('distanceBar').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'flex';
}

function createFlash() {
    for (let i = 0; i < 12; i++) {
        particles.push({
            x: canvas.width/2 + (Math.random()-0.5)*canvas.width,
            y: canvas.height/2 + (Math.random()-0.5)*canvas.height,
            life: 300,
            vx: 0,
            vy: 0,
            type: 'flash',
            color: '#ffffff'
        });
    }
}

function createShockwave() {
    const x = getLaneX(runner.lane, worldToScreenZ(catchDistance));
    const y = getScreenY(worldToScreenZ(catchDistance));
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        particles.push({
            x: x, y: y,
            life: 600,
            vx: Math.cos(angle) * 4,
            vy: Math.sin(angle) * 4,
            type: 'shockwave',
            color: runner.data.accent
        });
    }
}

function createZipEffect() {
    const x = getLaneX(runner.lane, worldToScreenZ(catchDistance));
    const y = getScreenY(worldToScreenZ(catchDistance));
    for (let i = 0; i < 10; i++) {
        particles.push({
            x: x, y: y,
            life: 400,
            vx: (Math.random()-0.5)*10,
            vy: -Math.random()*8,
            type: 'zip',
            color: '#00d4ff'
        });
    }
}

// ==================== RENDER ====================
function draw() {
    // Clear
    ctx.fillStyle = '#0d1b2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawBackground();
    drawTracks();
    
    // Draw runner ahead
    if (!runner.caught && catchDistance < VIEW_DISTANCE) {
        const rZ = worldToScreenZ(catchDistance);
        if (rZ > 0 && rZ < 1.5) {
            drawRunner(getLaneX(runner.lane, rZ), getScreenY(rZ), getScale(rZ), runner.animFrame, runner.data);
        }
    }
    
    // Draw obstacles (sorted by Z for proper depth)
    const visibleObs = obstacles.map(o => {
        const ahead = o.distance - player.worldZ;
        return { ...o, ahead, z: worldToScreenZ(ahead) };
    }).filter(o => o.z > -0.2 && o.z < 1.3);
    
    visibleObs.sort((a, b) => a.z - b.z);
    visibleObs.forEach(o => drawObstacle(o));
    
    // Draw particles
    particles.forEach(p => drawParticle(p));
    
    // Draw player (Norm)
    const pZ = 0.72;
    drawNorm(getLaneX(player.lane, pZ), getScreenY(pZ) - player.jumpY, getScale(pZ), player.animFrame, player.sliding);
    
    // Draw Sable
    if (sable.active) {
        let sZ;
        if (sable.state === 'approaching') {
            const progress = 1 - (sable.approachTimer / 2500);
            sZ = 0.95 - progress * 0.15;
        } else {
            sZ = 0.85 + Math.sin(runTime / 150) * 0.02;
        }
        drawSable(getLaneX(sable.lane, sZ), getScreenY(sZ), getScale(sZ), sable.animFrame);
    }
}

function drawBackground() {
    // Industrial sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
    skyGrad.addColorStop(0, '#0d1b2a');
    skyGrad.addColorStop(0.6, '#1b263b');
    skyGrad.addColorStop(1, '#415a77');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, HORIZON_Y);
    
    // Distant industrial silhouette
    ctx.fillStyle = '#0d1b2a';
    for (let i = 0; i < 15; i++) {
        const h = 20 + Math.sin(i * 1.5) * 15 + Math.cos(i * 2.3) * 10;
        const w = 30 + Math.random() * 20;
        const x = (i / 15) * canvas.width;
        ctx.fillRect(x, HORIZON_Y - h, w, h);
    }
    
    // Fence posts in distance
    ctx.strokeStyle = '#1b263b';
    ctx.lineWidth = 2;
    for (let i = 0; i < 20; i++) {
        const x = (i / 20) * canvas.width;
        ctx.beginPath();
        ctx.moveTo(x, HORIZON_Y);
        ctx.lineTo(x + (x - canvas.width/2) * 0.1, HORIZON_Y - 15);
        ctx.stroke();
    }
}

function drawTracks() {
    const center = canvas.width / 2;
    const trackSpread = ROAD_WIDTH / 2;
    
    // Gravel bed
    ctx.fillStyle = '#2d2d2d';
    ctx.beginPath();
    ctx.moveTo(center - trackSpread * 0.3, HORIZON_Y);
    ctx.lineTo(center + trackSpread * 0.3, HORIZON_Y);
    ctx.lineTo(center + trackSpread * 1.2, canvas.height);
    ctx.lineTo(center - trackSpread * 1.2, canvas.height);
    ctx.fill();
    
    // Gravel texture (dots)
    ctx.fillStyle = '#3d3d3d';
    for (let i = 0; i < 80; i++) {
        const gx = center + (Math.random() - 0.5) * trackSpread * 2.2;
        const gy = HORIZON_Y + Math.random() * (canvas.height - HORIZON_Y);
        ctx.fillRect(gx, gy, 2, 2);
    }
    
    // Rails
    ctx.strokeStyle = '#8899a6';
    ctx.lineWidth = 4;
    const leftRailX = getLaneX(-1.6, 1);
    const rightRailX = getLaneX(1.6, 1);
    
    ctx.beginPath();
    ctx.moveTo(getLaneX(-1.6, 0), HORIZON_Y);
    ctx.lineTo(leftRailX, canvas.height);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(getLaneX(1.6, 0), HORIZON_Y);
    ctx.lineTo(rightRailX, canvas.height);
    ctx.stroke();
    
    // Rail shine
    ctx.strokeStyle = '#aabbcc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(getLaneX(-1.6, 0), HORIZON_Y);
    ctx.lineTo(leftRailX, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(getLaneX(1.6, 0), HORIZON_Y);
    ctx.lineTo(rightRailX, canvas.height);
    ctx.stroke();
    
    // Wooden sleepers
    sleepers.forEach(s => {
        const ahead = s.distance - player.worldZ;
        const z = worldToScreenZ(ahead);
        if (z < 0 || z > 1.2) return;
        
        const y = getScreenY(z);
        const scale = getScale(z);
        const width = ROAD_WIDTH * scale * 1.3;
        
        ctx.fillStyle = '#3e2723';
        ctx.fillRect(center - width/2, y - 3 * scale, width, 6 * scale);
        
        // Sleeper detail
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(center - width/2 + 5*scale, y - 2*scale, width - 10*scale, 4*scale);
    });
    
    // Lane markers (subtle)
    for (let i = -1; i <= 1; i++) {
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(getLaneX(i, 0), HORIZON_Y);
        ctx.lineTo(getLaneX(i, 1), canvas.height);
        ctx.stroke();
    }
}

function drawNorm(x, y, scale, frame, sliding) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    
    if (sliding) ctx.scale(1.3, 0.6);
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 45, 30, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    
    const legSwing = sliding ? 5 : Math.sin(frame) * 15;
    const armSwing = sliding ? 3 : Math.cos(frame) * 12;
    
    // Legs (dark blue pants)
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(-14, 10, 12, 30 + legSwing);
    ctx.fillRect(2, 10, 12, 30 - legSwing);
    
    // Shoes
    ctx.fillStyle = '#111';
    ctx.fillRect(-16, 38 + legSwing, 16, 8);
    ctx.fillRect(2, 38 - legSwing, 16, 8);
    
    // Torso (security shirt — light blue)
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(-16, -20, 32, 35);
    
    // Belt
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(-16, 12, 32, 6);
    
    // Badge
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(-6, -5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b45309';
    ctx.font = 'bold 5px Arial';
    ctx.fillText('SEC', -8, -3);
    
    // Arms
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(-28, -15, 10, 28 + armSwing);
    ctx.fillRect(18, -15, 10, 28 - armSwing);
    
    // Hands
    ctx.fillStyle = '#fca5a5';
    ctx.beginPath();
    ctx.arc(-23, 15 + armSwing, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(23, 15 - armSwing, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Head
    ctx.fillStyle = '#fca5a5';
    ctx.beginPath();
    ctx.arc(0, -32, 14, 0, Math.PI * 2);
    ctx.fill();
    
    // Cap (security cap)
    ctx.fillStyle = '#1e40af';
    ctx.beginPath();
    ctx.arc(0, -36, 14, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-16, -36, 32, 5);
    // Cap brim
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(-10, -34, 20, 4);
    
    // Face
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.arc(-4, -32, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(4, -32, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Flashlight on belt
    ctx.fillStyle = '#374151';
    ctx.fillRect(10, 8, 6, 10);
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.arc(13, 18, 3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

function drawRunner(x, y, scale, frame, data) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * 0.85, scale * 0.85);
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 45, 25, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    const legSwing = Math.sin(frame) * 18;
    const armSwing = Math
