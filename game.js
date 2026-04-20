// ==================== GAME CONFIG ====================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
function resizeCanvas() {
    const container = document.getElementById('gameContainer');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Game states
const STATE = {
    MENU: 0,
    CHAR_SELECT: 1,
    PLAYING: 2,
    PAUSED: 3,
    GAMEOVER: 4
};

// Lanes
const LANES = [-1, 0, 1]; // left, center, right
const LANE_WIDTH = 120;

// ==================== CHARACTERS ====================
const CHARACTERS = {
    // VANDALS - Easy to Hard
    tag: {
        name: "Tag",
        faction: "vandal",
        diff: "easy",
        diffColor: "diff-easy",
        icon: "T",
        ability: "Basic Runner",
        desc: "Just a kid with a backpack. No tricks.",
        speed: 1.0,
        abilityCooldown: 999999, // basically never
        abilityFunc: null
    },
    roller: {
        name: "Roller",
        faction: "vandal",
        diff: "medium",
        diffColor: "diff-med",
        icon: "R",
        ability: "Paint Trail",
        desc: "Leaves slippery paint behind",
        speed: 1.1,
        abilityCooldown: 4000,
        abilityFunc: 'paintTrail'
    },
    chrome: {
        name: "Chrome",
        faction: "vandal",
        diff: "hard",
        diffColor: "diff-hard",
        icon: "C",
        ability: "Flashbang",
        desc: "Blinding reflection when caught",
        speed: 1.2,
        abilityCooldown: 3000,
        abilityFunc: 'flashbang'
    },
    
    // DATAPUNKS - Easy to Hard
    pixel: {
        name: "Pixel",
        faction: "datapunk",
        diff: "easy",
        diffColor: "diff-easy",
        icon: "P",
        ability: "Pixelate",
        desc: "Obstacles flicker - stay focused",
        speed: 1.0,
        abilityCooldown: 5000,
        abilityFunc: 'pixelate'
    },
    echo: {
        name: "Echo",
        faction: "datapunk",
        diff: "medium",
        diffColor: "diff-med",
        icon: "E",
        ability: "Sonic Push",
        desc: "Sound wave pushes you back",
        speed: 1.15,
        abilityCooldown: 3500,
        abilityFunc: 'sonicPush'
    },
    zip: {
        name: "Zip",
        faction: "datapunk",
        diff: "hard",
        diffColor: "diff-hard",
        icon: "Z",
        ability: "Zip Around",
        desc: "Teleports ahead suddenly",
        speed: 1.3,
        abilityCooldown: 2500,
        abilityFunc: 'teleport'
    }
};

// ==================== GAME STATE ====================
let gameState = STATE.MENU;
let selectedChar = null;
let score = 0;
let distance = 0;
let gameSpeed = 5;
let baseSpeed = 5;

// Player (Norm)
const player = {
    lane: 1, // 0, 1, 2
    x: 0,
    y: 0,
    width: 40,
    height: 60,
    jumping: false,
    jumpHeight: 0,
    jumpVelocity: 0,
    sliding: false,
    slideTimer: 0,
    caught: false,
    stunTimer: 0,
    flashTimer: 0,
    pushbackTimer: 0
};

// Runner
const runner = {
    lane: 1,
    x: 0,
    y: 0,
    width: 35,
    height: 55,
    distance: 200, // distance ahead of player
    abilityTimer: 0,
    lastAbility: 0,
    caught: false,
    escapeTimer: 0
};

// Sable (Chaser)
const sable = {
    active: false,
    x: -200,
    y: 0,
    width: 80,
    height: 90,
    speed: 0,
    state: 'idle', // idle, chase, catch
    timer: 0,
    lane: 1
};

// World
let obstacles = [];
let decorations = [];
let particles = [];
let trainCars = [];
let groundOffset = 0;

// Timers
let lastTime = 0;
let spawnTimer = 0;
let decorTimer = 0;

// ==================== INPUT HANDLING ====================
const keys = {};
let touchStartY = 0;
let touchStartX = 0;

document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    
    if (gameState === STATE.PLAYING) {
        // Lane switching
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
            if (player.lane > 0) player.lane--;
        }
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            if (player.lane < 2) player.lane++;
        }
        // Jump
        if ((e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') && !player.jumping && !player.sliding) {
            player.jumping = true;
            player.jumpVelocity = 15;
        }
        // Slide
        if ((e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') && !player.jumping && !player.sliding) {
            player.sliding = true;
            player.slideTimer = 800; // ms
        }
    }
    
    if (e.key === 'Escape' && gameState === STATE.PLAYING) {
        pauseGame();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

// Mobile controls
document.getElementById('btnLeft').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (player.lane > 0) player.lane--;
});
document.getElementById('btnRight').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (player.lane < 2) player.lane++;
});
document.getElementById('btnJump').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!player.jumping && !player.sliding) {
        player.jumping = true;
        player.jumpVelocity = 15;
    }
});
document.getElementById('btnSlide').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!player.jumping && !player.sliding) {
        player.sliding = true;
        player.slideTimer = 800;
    }
});

// Touch swipe
canvas.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
});

canvas.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    
    if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 30 && player.lane < 2) player.lane++;
        else if (dx < -30 && player.lane > 0) player.lane--;
    } else {
        if (dy < -30 && !player.jumping && !player.sliding) {
            player.jumping = true;
            player.jumpVelocity = 15;
        } else if (dy > 30 && !player.jumping && !player.sliding) {
            player.sliding = true;
            player.slideTimer = 800;
        }
    }
});

// ==================== MENU HANDLING ====================
document.getElementById('playBtn').addEventListener('click', showCharSelect);
document.getElementById('infoBtn').addEventListener('click', () => {
    document.getElementById('infoText').style.display = 'block';
});
document.getElementById('pauseBtn').addEventListener('click', pauseGame);
document.getElementById('resumeBtn').addEventListener('click', resumeGame);
document.getElementById('menuBtn').addEventListener('click', returnToMenu);
document.getElementById('retryBtn').addEventListener('click', () => startGame(selectedChar));
document.getElementById('endMenuBtn').addEventListener('click', returnToMenu);
document.getElementById('startRunBtn').addEventListener('click', () => {
    if (selectedChar) startGame(selectedChar);
});

function showCharSelect() {
    document.getElementById('startMenu').style.display = 'none';
    document.getElementById('charSelect').style.display = 'flex';
    
    // Populate grids
    const vandalGrid = document.getElementById('vandalGrid');
    const datapunkGrid = document.getElementById('datapunkGrid');
    
    vandalGrid.innerHTML = '';
    datapunkGrid.innerHTML = '';
    
    Object.entries(CHARACTERS).forEach(([id, char]) => {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.innerHTML = `
            <div class="char-icon ${char.faction === 'vandal' ? 'vandal-icon' : 'datapunk-icon'}">${char.icon}</div>
            <div class="char-name">${char.name}</div>
            <span class="char-diff ${char.diffColor}">${char.diff.toUpperCase()}</span>
            <div class="char-ability">${char.ability}</div>
        `;
        card.addEventListener('click', () => selectChar(id, card));
        
        if (char.faction === 'vandal') {
            vandalGrid.appendChild(card);
        } else {
            datapunkGrid.appendChild(card);
        }
    });
}

function selectChar(id, cardElement) {
    selectedChar = id;
    document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
    cardElement.classList.add('selected');
    document.getElementById('startRunBtn').style.display = 'block';
}

function returnToMenu() {
    gameState = STATE.MENU;
    document.getElementById('startMenu').style.display = 'flex';
    document.getElementById('charSelect').style.display = 'none';
    document.getElementById('pauseScreen').style.display = 'none';
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('hud').style.display = 'none';
}

function pauseGame() {
    if (gameState === STATE.PLAYING) {
        gameState = STATE.PAUSED;
        document.getElementById('pauseScreen').style.display = 'flex';
    }
}

function resumeGame() {
    if (gameState === STATE.PAUSED) {
        gameState = STATE.PLAYING;
        document.getElementById('pauseScreen').style.display = 'none';
        lastTime = performance.now();
        requestAnimationFrame(gameLoop);
    }
}

// ==================== GAME INITIALIZATION ====================
function startGame(charId) {
    const char = CHARACTERS[charId];
    selectedChar = charId;
    
    // Reset game state
    score = 0;
    distance = 0;
    gameSpeed = baseSpeed * char.speed;
    
    // Reset player
    player.lane = 1;
    player.jumping = false;
    player.jumpHeight = 0;
    player.jumpVelocity = 0;
    player.sliding = false;
    player.slideTimer = 0;
    player.caught = false;
    player.stunTimer = 0;
    player.flashTimer = 0;
    player.pushbackTimer = 0;
    
    // Reset runner
    runner.lane = Math.floor(Math.random() * 3);
    runner.distance = 300 + Math.random() * 200;
    runner.abilityTimer = 0;
    runner.lastAbility = 0;
    runner.caught = false;
    runner.escapeTimer = 0;
    
    // Reset Sable
    sable.active = false;
    sable.x = -200;
    sable.state = 'idle';
    sable.timer = 0;
    
    // Clear arrays
    obstacles = [];
    decorations = [];
    particles = [];
    trainCars = [];
    
    // Generate initial train cars
    for (let i = 0; i < 5; i++) {
        trainCars.push({
            x: i * 400,
            width: 380,
            height: 200,
            color: i % 2 === 0 ? '#2d3748' : '#4a5568'
        });
    }
    
    // Hide menus
    document.getElementById('charSelect').style.display = 'none';
    document.getElementById('startMenu').style.display = 'none';
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('hud').style.display = 'flex';
    
    gameState = STATE.PLAYING;
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

// ==================== OBSTACLE SYSTEM ====================
function spawnObstacle() {
    const lane = Math.floor(Math.random() * 3);
    const type = Math.random();
    
    let obstacle = {
        lane: lane,
        x: canvas.width + 100,
        y: 0,
        width: 50,
        height: 50,
        type: '',
        passed: false,
        z: 800 // distance from camera
    };
    
    if (type < 0.4) {
        // Crate - must jump
        obstacle.type = 'crate';
        obstacle.width = 55;
        obstacle.height = 55;
        obstacle.color = '#8B4513';
    } else if (type < 0.7) {
        // Barrier - must slide
        obstacle.type = 'barrier';
        obstacle.width = 60;
        obstacle.height = 40;
        obstacle.color = '#FF6B35';
        obstacle.yOffset = -20; // hangs down
    } else {
        // Train equipment - must switch lane
        obstacle.type = 'equipment';
        obstacle.width = 70;
        obstacle.height = 60;
        obstacle.color = '#718096';
    }
    
    obstacles.push(obstacle);
}

function spawnDecoration() {
    const side = Math.random() > 0.5 ? 'left' : 'right';
    decorations.push({
        x: side === 'left' ? -50 : canvas.width + 50,
        z: 1000 + Math.random() * 500,
        type: Math.random() > 0.5 ? 'lamp' : 'sign',
        side: side
    });
}

// ==================== ABILITY SYSTEM ====================
function triggerAbility(char) {
    const now = Date.now();
    if (now - runner.lastAbility < char.abilityCooldown * 1000) return;
    
    runner.lastAbility = now;
    
    switch(char.abilityFunc) {
        case 'paintTrail':
            // Spawn paint puddles in runner's lane
            for (let i = 0; i < 3; i++) {
                particles.push({
                    x: getLaneX(runner.lane),
                    z: runner.distance - i * 50,
                    type: 'paint',
                    life: 3000,
                    color: '#e94560'
                });
            }
            break;
            
        case 'flashbang':
            player.flashTimer = 1500;
            runner.distance += 150;
            createFlashEffect();
            break;
            
        case 'pixelate':
            // Make next obstacles flicker
            obstacles.forEach(o => {
                if (o.z > runner.distance && o.z < runner.distance + 300) {
                    o.pixelated = true;
                }
            });
            break;
            
        case 'sonicPush':
            player.pushbackTimer = 1000;
            runner.distance += 100;
            createShockwave(getLaneX(runner.lane), runner.distance);
            break;
            
        case 'teleport':
            runner.distance += 200;
            runner.lane = Math.floor(Math.random() * 3);
            createTeleportEffect();
            break;
    }
}

function createFlashEffect() {
    for (let i = 0; i < 20; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            z: 0,
            type: 'flash',
            life: 500,
            size: Math.random() * 100 + 50
        });
    }
}

function createShockwave(x, z) {
    for (let i = 0; i < 10; i++) {
        particles.push({
            x: x,
            z: z,
            type: 'shockwave',
            life: 800,
            radius: 0,
            maxRadius: 100
        });
    }
}

function createTeleportEffect() {
    for (let i = 0; i < 15; i++) {
        particles.push({
            x: getLaneX(runner.lane),
            z: runner.distance,
            type: 'teleport',
            life: 600,
            offset: Math.random() * Math.PI * 2
        });
    }
}

// ==================== SABLE SYSTEM ====================
function updateSable(dt) {
    // Sable appears after 10 seconds
    if (!sable.active && distance > 1000) {
        sable.active = true;
        sable.state = 'chase';
        sable.x = -150;
        sable.lane = player.lane;
    }
    
    if (!sable.active) return;
    
    // Sable follows player's lane but stays behind
    const targetX = getLaneX(player.lane);
    sable.lane = player.lane;
    
    // Move Sable
    if (sable.state === 'chase') {
        sable.x += (targetX - sable.x) * 0.05;
        sable.x = Math.max(-200, Math.min(sable.x, targetX - 80));
        
        // If player hits obstacle, Sable catches them
        if (player.stunTimer > 0 && sable.x > targetX - 150) {
            sable.state = 'catch';
            player.caught = true;
            endGame(false);
        }
    }
}

function drawSable() {
    if (!sable.active) return;
    
    const x = sable.x;
    const y = canvas.height - 150;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + 40, y + 85, 50, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Body - muscular Doberman
    ctx.fillStyle = '#1a1a1a';
    
    // Main body
    ctx.beginPath();
    ctx.ellipse(x + 40, y + 50, 45, 35, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Chest
    ctx.beginPath();
    ctx.ellipse(x + 40, y + 35, 30, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Head
    ctx.beginPath();
    ctx.ellipse(x + 40, y + 10, 22, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Snout
    ctx.fillStyle = '#2d2d2d';
    ctx.beginPath();
    ctx.ellipse(x + 40, y + 5, 15, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Ears (pointed)
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(x + 25, y - 5);
    ctx.lineTo(x + 30, y - 30);
    ctx.lineTo(x + 35, y - 5);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(x + 45, y - 5);
    ctx.lineTo(x + 50, y - 30);
    ctx.lineTo(x + 55, y - 5);
    ctx.fill();
    
    // Eyes (glowing red)
    ctx.fillStyle = '#ff0000';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x + 33, y + 8, 4, 0, Math.PI * 2);
    ctx.arc(x + 47, y + 8, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Legs
    ctx.fillStyle = '#1a1a1a';
    // Front legs
    ctx.fillRect(x + 25, y + 60, 12, 30);
    ctx.fillRect(x + 43, y + 60, 12, 30);
    // Back legs
    ctx.fillRect(x + 15, y + 65, 14, 25);
    ctx.fillRect(x + 51, y + 65, 14, 25);
    
    // Paws
    ctx.fillStyle = '#2d2d2d';
    ctx.beginPath();
    ctx.ellipse(x + 31, y + 92, 8, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 49, y + 92, 8, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 22, y + 92, 9, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 58, y + 92, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Tail
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 60);
    ctx.quadraticCurveTo(x - 10, y + 40, x - 5, y + 20);
    ctx.lineTo(x + 5, y + 55);
    ctx.fill();
    
    // Rust markings (Doberman pattern)
    ctx.fillStyle = '#8B4513';
    ctx.globalAlpha = 0.6;
    // Muzzle
    ctx.beginPath();
    ctx.ellipse(x + 40, y + 15, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eyebrows
    ctx.beginPath();
    ctx.ellipse(x + 30, y + 2, 5, 3, 0.5, 0, Math.PI * 2);
    ctx.ellipse(x + 50, y + 2, 5, 3, -0.5, 0, Math.PI * 2);
    ctx.fill();
    // Chest patch
    ctx.beginPath();
    ctx.ellipse(x + 40, y + 45, 15, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Legs
    ctx.fillRect(x + 26, y + 75, 10, 12);
    ctx.fillRect(x + 44, y + 75, 10, 12);
    ctx.globalAlpha = 1;
    
    // Heart-shaped white patch on chest
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    const hx = x + 40, hy = y + 40;
    ctx.moveTo(hx, hy + 5);
    ctx.bezierCurveTo(hx - 8, hy - 5, hx - 8, hy - 10, hx - 4, hy - 8);
    ctx.bezierCurveTo(hx, hy - 6, hx, hy - 6, hx + 4, hy - 8);
    ctx.bezierCurveTo(hx + 8, hy - 10, hx + 8, hy - 5, hx, hy + 5);
    ctx.fill();
    
    // Drool/steam from mouth when chasing
    if (sable.state === 'chase') {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.arc(x + 40, y + 18, 3 + Math.sin(Date.now() / 200) * 2, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SABLE', x + 40, y - 35);
}

// ==================== HELPER FUNCTIONS ====================
function getLaneX(laneIndex) {
    const centerX = canvas.width / 2;
    return centerX + (laneIndex - 1) * LANE_WIDTH;
}

function worldToScreen(z) {
    // Perspective projection
    const horizonY = canvas.height * 0.3;
    const groundY = canvas.height;
    const progress = z / 1000; // 0 = far, 1 = close
    
    return {
        y: horizonY + (groundY - horizonY) * (1 - progress),
        scale: 0.3 + 0.7 * (1 - progress),
        alpha: Math.max(0, Math.min(1, (1 - progress) * 2))
    };
}

// ==================== UPDATE GAME ====================
function update(dt) {
    if (gameState !== STATE.PLAYING) return;
    
    const char = CHARACTERS[selectedChar];
    
    // Update distance
    distance += gameSpeed * (dt / 16);
    
    // Update player physics
    if (player.jumping) {
        player.jumpHeight += player.jumpVelocity;
        player.jumpVelocity -= 0.8; // gravity
        
        if (player.jumpHeight <= 0) {
            player.jumpHeight = 0;
            player.jumping = false;
        }
    }
    
    if (player.sliding) {
        player.slideTimer -= dt;
        if (player.slideTimer <= 0) {
            player.sliding = false;
        }
    }
    
    // Update stun/pushback
    if (player.stunTimer > 0) player.stunTimer -= dt;
    if (player.flashTimer > 0) player.flashTimer -= dt;
    if (player.pushbackTimer > 0) {
        player.pushbackTimer -= dt;
        distance -= 2; // push back
    }
    
    // Update runner
    runner.distance -= (gameSpeed - 2) * (dt / 16); // runner moves slower than player
    
    // Runner lane switching (AI)
    if (Math.random() < 0.01 && runner.distance < 500) {
        const newLane = Math.floor(Math.random() * 3);
        if (Math.abs(newLane - runner.lane) <= 1) runner.lane = newLane;
    }
    
    // Runner ability trigger
    if (runner.distance < 300 && runner.distance > 50 && !runner.caught) {
        triggerAbility(char);
    }
    
    // Spawn obstacles
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
        spawnObstacle();
        spawnTimer = 1500 + Math.random() * 1500;
    }
    
    // Spawn decorations
    decorTimer -= dt;
    if (decorTimer <= 0) {
        spawnDecoration();
        decorTimer = 500 + Math.random() * 1000;
    }
    
    // Update obstacles
    obstacles = obstacles.filter(o => {
        o.z -= gameSpeed * (dt / 16) * 10;
        
        // Check collision
        if (o.z < 50 && o.z > -50 && !o.passed) {
            const laneX = getLaneX(o.lane);
            const playerX = getLaneX(player.lane);
            
            if (Math.abs(laneX - playerX) < 40) { // same lane
                if (o.type === 'crate' && !player.jumping) {
                    // Hit crate while not jumping
                    player.stunTimer = 800;
                    o.passed = true;
                    createHitEffect(playerX, 0);
                } else if (o.type === 'barrier' && !player.sliding) {
                    // Hit barrier while not sliding
                    player.stunTimer = 800;
                    o.passed = true;
                    createHitEffect(playerX, 0);
                } else if (o.type === 'equipment') {
                    // Always hits unless in different lane
                    player.stunTimer = 600;
                    o.passed = true;
                    createHitEffect(playerX, 0);
                }
            }
        }
        
        return o.z > -200;
    });
    
    // Update particles
    particles = particles.filter(p => {
        p.life -= dt;
        if (p.type === 'shockwave') {
            p.radius += 2;
        }
        return p.life > 0;
    });
    
    // Update train cars
    trainCars.forEach(car => {
        car.x -= gameSpeed * (dt / 16) * 0.5;
        if (car.x < -400) car.x += 2000;
    });
    
    // Update decorations
    decorations = decorations.filter(d => {
        d.z -= gameSpeed * (dt / 16) * 10;
        return d.z > -200;
    });
    
    // Update Sable
    updateSable(dt);
    
    // Check catch
    if (runner.distance < 30 && !runner.caught && player.stunTimer <= 0) {
        runner.caught = true;
        score += 100;
        endGame(true);
    }
    
    // Check if runner escaped
    if (runner.distance < -100) {
        endGame(false);
    }
    
    // Score
    score += Math.floor(gameSpeed * (dt / 16));
    document.getElementById('scoreDisplay').textContent = `$${score}`;
}

function createHitEffect(x, z) {
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: x + (Math.random() - 0.5) * 30,
            z: z,
            type: 'spark',
            life: 400,
            vx: (Math.random() - 0.5) * 4,
            vy: -Math.random() * 5
        });
    }
}

function endGame(caught) {
    gameState = STATE.GAMEOVER;
    
    const title = document.getElementById('endTitle');
    const stats = document.getElementById('endStats');
    
    if (caught) {
        title.textContent = 'CAUGHT!';
        title.style.color = '#4ade80';
        stats.innerHTML = `
            <p>Target: ${CHARACTERS[selectedChar].name}</p>
            <p>Distance: ${Math.floor(distance)}m</p>
            <p>Bounty: $${score}</p>
            <p style="color:#4ade80;margin-top:10px;">Target apprehended!</p>
        `;
    } else {
        title.textContent = 'ESCAPED!';
        title.style.color = '#f87171';
        stats.innerHTML = `
            <p>Target: ${CHARACTERS[selectedChar].name}</p>
            <p>Distance: ${Math.floor(distance)}m</p>
            <p>Bounty: $${score}</p>
            <p style="color:#f87171;margin-top:10px;">Target got away!</p>
        `;
    }
    
    document.getElementById('gameOver').style.display = 'flex';
    document.getElementById('hud').style.display = 'none';
}

// ==================== RENDERING ====================
function draw() {
    // Clear
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Sky gradient (night)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.4);
    skyGrad.addColorStop(0, '#0c1445');
    skyGrad.addColorStop(0.5, '#1a237e');
    skyGrad.addColorStop(1, '#283593');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.4);
    
    // Stars
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 50; i++) {
        const sx = (i * 137.5) % canvas.width;
        const sy = (i * 71.3) % (canvas.height * 0.35);
        ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 1000 + i) * 0.3;
        ctx.beginPath();
        ctx.arc(sx, sy, 1 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    
    // Moon
    ctx.fillStyle = '#fffde7';
    ctx.beginPath();
    ctx.arc(canvas.width * 0.8, 60, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0c1445';
    ctx.beginPath();
    ctx.arc(canvas.width * 0.8 + 10, 55, 25, 0, Math.PI * 2);
    ctx.fill();
    
    // City skyline (far background)
    ctx.fillStyle = '#1a1a2e';
    const buildingWidth = 60;
    for (let i = 0; i < canvas.width / buildingWidth + 2; i++) {
        const h = 50 + Math.sin(i * 3.7) * 30 + Math.cos(i * 2.3) * 20;
        const bx = (i * buildingWidth - distance * 0.1) % (canvas.width + buildingWidth) - buildingWidth;
        ctx.fillRect(bx, canvas.height * 0.4 - h, buildingWidth + 2, h);
        
        // Windows
        ctx.fillStyle = '#ffd700';
        for (let wy = canvas.height * 0.4 - h + 10; wy < canvas.height * 0.4 - 5; wy += 15) {
            for (let wx = bx + 8; wx < bx + buildingWidth - 5; wx += 12) {
                if (Math.sin(wx * wy) > 0.3) {
                    ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 2000 + wx) * 0.3;
                    ctx.fillRect(wx, wy, 6, 8);
                }
            }
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#1a1a2e';
    }
    
    // Ground (train yard)
    const groundY = canvas.height * 0.4;
    
    // Ground gradient
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, canvas.height);
    groundGrad.addColorStop(0, '#2d3748');
    groundGrad.addColorStop(0.3, '#4a5568');
    groundGrad.addColorStop(1, '#1a202c');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
    
    // Train tracks
    const trackSpacing = LANE_WIDTH;
    const centerX = canvas.width / 2;
    
    ctx.strokeStyle = '#718096';
    ctx.lineWidth = 3;
    
    // Rails
    for (let i = -1; i <= 1; i++) {
        const rx = centerX + i * trackSpacing;
        ctx.beginPath();
        ctx.moveTo(rx, groundY);
        ctx.lineTo(rx - 100, canvas.height);
        ctx.stroke();
    }
    
    // Cross ties
    ctx.fillStyle = '#5a4a3a';
    const tieSpacing = 40;
    const tieOffset = (distance * 2) % tieSpacing;
    for (let i = -tieSpacing; i < canvas.height - groundY + tieSpacing; i += tieSpacing) {
        const y = groundY + i + tieOffset;
        if (y > groundY && y < canvas.height) {
            ctx.fillRect(centerX - LANE_WIDTH * 1.5 - 20, y, LANE_WIDTH * 3 + 40, 8);
        }
    }
    
    // Gravel texture
    ctx.fillStyle = '#3d3d3d';
    for (let i = 0; i < 100; i++) {
        const gx = (i * 73 + distance) % canvas.width;
        const gy = groundY + 20 + (i * 37) % (canvas.height - groundY - 20);
        ctx.fillRect(gx, gy, 3, 2);
    }
    
    // Draw train cars (background elements)
    trainCars.forEach(car => {
        const cx = car.x - distance * 0.5;
        if (cx > -400 && cx < canvas.width + 400) {
            // Car body
            ctx.fillStyle = car.color;
            ctx.fillRect(cx, groundY + 50, car.width, car.height);
            
            // Windows
            ctx.fillStyle = '#1a202c';
            for (let w = 0; w < 3; w++) {
                ctx.fillRect(cx + 20 + w * 120, groundY + 70, 80, 40);
            }
            
            // Graffiti on train
            ctx.fillStyle = '#e94560';
            ctx.font = 'bold 20px sans-serif';
            ctx.save();
            ctx.translate(cx + 100, groundY + 140);
            ctx.rotate(-0.1);
            ctx.fillText('VANDALS', 0, 0);
            ctx.restore();
            
            // Wheels
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.arc(cx + 60, groundY + 250, 25, 0, Math.PI * 2);
            ctx.arc(cx + 320, groundY + 250, 25, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    
    // Draw lane markers (faint)
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) {
        const lx = centerX + i * LANE_WIDTH;
        ctx.beginPath();
        ctx.moveTo(lx, groundY);
        ctx.lineTo(lx - 100, canvas.height);
        ctx.stroke();
    }
    
    // Draw decorations
    decorations.forEach(d => {
        const proj = worldToScreen(d.z);
        const x = d.side === 'left' ? 50 : canvas.width - 50;
        const y = proj.y;
        const s = proj.scale;
        
        ctx.globalAlpha = proj.alpha;
        
        if (d.type === 'lamp') {
            // Lamp post
            ctx.fillStyle = '#4a5568';
            ctx.fillRect(x - 3 * s, y - 100 * s, 6 * s, 100 * s);
            // Light
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(x, y - 100 * s, 8 * s, 0, Math.PI * 2);
            ctx.fill();
            // Glow
            ctx.fillStyle = 'rgba(255,215,0,0.2)';
            ctx.beginPath();
            ctx.arc(x, y - 100 * s, 25 * s, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Sign
            ctx.fillStyle = '#2d3748';
            ctx.fillRect(x - 30 * s, y - 80 * s, 60 * s, 40 * s);
            ctx.fillStyle = '#e94560';
            ctx.font = `bold ${10 * s}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('YARD', x, y - 55 * s);
        }
        
        ctx.globalAlpha = 1;
    });
    
    // Draw obstacles
    obstacles.forEach(o => {
        const proj = worldToScreen(o.z);
        const x = getLaneX(o.lane);
        const y = proj.y;
        const s = proj.scale;
        
        ctx.globalAlpha = proj.alpha;
        
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(x, y + 5, o.width * s * 0.6, 8 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        
        if (o.type === 'crate') {
            // Wooden crate
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(x - o.width * s / 2, y - o.height * s, o.width * s, o.height * s);
            
            // Wood grain/detail
            ctx.fillStyle = '#A0522D';
            ctx.fillRect(x - o.width * s / 2 + 3, y - o.height * s + 3, o.width * s - 6, o.height * s / 3);
            ctx.fillRect(x - o.width * s / 2 + 3, y - o.height * s / 2, o.width * s - 6, o.height * s / 3);
            
            // Warning stripe
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.moveTo(x - o.width * s / 2, y - o.height * s);
            ctx.lineTo(x - o.width * s / 2 + 10 * s, y - o.height * s);
            ctx.lineTo(x - o.width * s / 2, y - o.height * s + 10 * s);
            ctx.fill();
            
        } else if (o.type === 'barrier') {
            // Barrier - must slide under
            ctx.fillStyle = '#FF6B35';
            ctx.fillRect(x - o.width * s / 2, y - o.height * s - 30 * s, o.width * s, o.height * s);
            
            // Stripes
            ctx.fillStyle = '#FFD700';
            for (let i = 0; i < 3; i++) {
                ctx.fillRect(x - o.width * s / 2 + i * 20 * s, y - o.height * s - 30 * s, 10 * s, o.height * s);
            }
            
            // Support legs
            ctx.fillStyle = '#718096';
            ctx.fillRect(x - o.width * s / 2 + 5, y - 30 * s, 8 * s, 30 * s);
            ctx.fillRect(x + o.width * s / 2 - 15, y - 30 * s, 8 * s, 30 * s);
            
        } else if (o.type === 'equipment') {
            // Train equipment (generator, toolbox, etc)
            ctx.fillStyle = '#4a5568';
            ctx.fillRect(x - o.width * s / 2, y - o.height * s, o.width * s, o.height * s);
            
            // Detail
            ctx.fillStyle = '#2d3748';
            ctx.fillRect(x - o.width * s / 2 + 5, y - o.height * s + 5, o.width * s - 10, o.height * s - 10);
            
            // Handle
            ctx.fillStyle = '#718096';
            ctx.fillRect(x - 8 * s, y - o.height * s - 8 * s, 16 * s, 8 * s);
        }
        
        // Pixelate effect for Pixel ability
        if (o.pixelated) {
            ctx.fillStyle = 'rgba(0,255,0,0.3)';
            ctx.fillRect(x - o.width * s / 2 - 5, y - o.height * s - 5, o.width * s + 10, o.height * s + 10);
        }
        
        ctx.globalAlpha = 1;
    });
    
    // Draw particles
    particles.forEach(p => {
        if (p.type === 'paint') {
            const proj = worldToScreen(p.z);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life / 3000;
            ctx.beginPath();
            ctx.arc(p.x, proj.y, 30 * proj.scale, 0, Math.PI * 2);
            ctx.fill();
        } else if (p.type === 'flash') {
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = p.life / 500;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        } else if (p.type === 'shockwave') {
            ctx.strokeStyle = '#00d4ff';
            ctx.lineWidth = 3;
            ctx.globalAlpha = p.life / 800;
            ctx.beginPath();
            ctx.arc(p.x, canvas.height - 100, p.radius, 0, Math.PI * 2);
            ctx.stroke();
        } else if (p.type === 'teleport') {
            const proj = worldToScreen(p.z);
            ctx.fillStyle = '#00d4ff';
            ctx.globalAlpha = p.life / 600;
            const offset = p.offset + Date.now() / 500;
            ctx.beginPath();
            ctx.arc(p.x + Math.cos(offset) * 20, proj.y + Math.sin(offset) * 20, 5, 0, Math.PI * 2);
            ctx.fill();
        } else if (p.type === 'spark') {
            ctx.fillStyle = '#ffd700';
            ctx.globalAlpha = p.life / 400;
            ctx.beginPath();
            ctx.arc(p.x + p.vx * (400 - p.life) / 10, canvas.height - 100 + p.vy * (400 - p.life) / 10, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    ctx.globalAlpha = 1;
    
    // Draw Sable (behind player if chasing)
    drawSable();
    
    // Draw runner
    if (!runner.caught && runner.distance > -100) {
        const rX = getLaneX(runner.lane);
        const rProj = worldToScreen(Math.max(0, runner.distance));
        const rY = rProj.y - 30 * rProj.scale;
        const rS = rProj.scale;
        
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(rX, rY + 50 * rS, 20 * rS, 6 * rS, 0, 0, Math.PI * 2);
        ctx.fill();
        
        const char = CHARACTERS[selectedChar];
        
        // Runner body
        if (char.faction === 'vandal') {
            // Vandal style - hoodie, casual
            ctx.fillStyle = char.name === 'Tag' ? '#9ca3af' : 
                          char.name === 'Roller' ? '#3b82f6' : '#c0c0c0';
            // Hoodie body
            ctx.beginPath();
            ctx.ellipse(rX, rY + 20 * rS, 18 * rS, 22 * rS, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Head
            ctx.fillStyle = '#fca5a5'; // skin
            ctx.beginPath();
            ctx.arc(rX, rY - 5 * rS, 12 * rS, 0, Math.PI * 2);
            ctx.fill();
            
            // Hood
            ctx.fillStyle = char.name === 'Tag' ? '#6b7280' : 
                          char.name === 'Roller' ? '#2563eb' : '#9ca3af';
            ctx.beginPath();
            ctx.arc(rX, rY - 8 * rS, 14 * rS, Math.PI, 0);
            ctx.fill();
            
        } else {
            // Datapunk style - tech, neon
            ctx.fillStyle = '#1e293b';
            // Tech suit body
            ctx.beginPath();
            ctx.ellipse(rX, rY + 20 * rS, 17 * rS, 21 * rS, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Neon accents
            ctx.strokeStyle = char.name === 'Pixel' ? '#4ade80' :
                            char.name === 'Echo' ? '#fbbf24' : '#00d4ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(rX - 15 * rS, rY + 5 * rS);
            ctx.lineTo(rX + 15 * rS, rY + 5 * rS);
            ctx.stroke();
            
            // Head
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(rX, rY - 5 * rS, 11 * rS, 0, Math.PI * 2);
            ctx.fill();
            
            // Visor/glasses
            ctx.fillStyle = char.name === 'Pixel' ? '#4ade80' :
                          char.name === 'Echo' ? '#fbbf24' : '#00d4ff';
            ctx.fillRect(rX - 10 * rS, rY - 8 * rS, 20 * rS, 5 * rS);
        }
        
        // Legs (running animation)
        ctx.fillStyle = char.faction === 'vandal' ? '#374151' : '#0f172a';
        const legOffset = Math.sin(Date.now() / 100) * 10 * rS;
        ctx.fillRect(rX - 8 * rS, rY + 35 * rS, 6 * rS, 18 * rS + legOffset);
        ctx.fillRect(rX + 2 * rS, rY + 35 * rS, 6 * rS, 18 * rS - legOffset);
        
        // Name label
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${10 * rS}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(char.name, rX, rY - 25 * rS);
    }
    
    // Draw player (Norm)
    const pX = getLaneX(player.lane);
    const pY = canvas.height - 120 - player.jumpHeight;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(pX, canvas.height - 100, 25, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Norm body
    // Tan shirt
    ctx.fillStyle = '#d4a574';
    const bodyH = player.sliding ? 30 : 45;
    const bodyW = 35;
    const bodyY = player.sliding ? pY + 15 : pY;
    
    ctx.beginPath();
    ctx.ellipse(pX, bodyY + 20, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Navy pants
    ctx.fillStyle = '#1e3a5f';
    const legH = player.sliding ? 15 : 25;
    ctx.fillRect(pX - 12, bodyY + bodyH / 2, 10, legH);
    ctx.fillRect(pX + 2, bodyY + bodyH / 2, 10, legH);
    
    // Head
    ctx.fillStyle = '#fca5a5';
    ctx.beginPath();
    ctx.arc(pX, bodyY - 15, 14, 0, Math.PI * 2);
    ctx.fill();
    
    // Mustache
    ctx.fillStyle = '#4a3728';
    ctx.beginPath();
    ctx.ellipse(pX, bodyY - 12, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Hair
    ctx.fillStyle = '#d4a574';
    ctx.beginPath();
    ctx.arc(pX, bodyY - 22, 12, Math.PI, 0);
    ctx.fill();
    
    // Security badge
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(pX - 3, bodyY + 5, 6, 8);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 6px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', pX, bodyY + 11);
    
    // Fanny pack
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(pX - 10, bodyY + 15, 20, 10);
    
    // Arms
    ctx.fillStyle = '#d4a574';
    if (player.sliding) {
        // Arms forward when sliding
        ctx.fillRect(pX - 20, bodyY + 10, 15, 8);
        ctx.fillRect(pX + 5, bodyY + 10, 15, 8);
    } else {
        ctx.fillRect(pX - 22, bodyY, 8, 20);
        ctx.fillRect(pX + 14, bodyY, 8, 20);
    }
    
    // Flash effect
    if (player.flashTimer > 0) {
        ctx.fillStyle = `rgba(255,255,255,${player.flashTimer / 1500})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Stun indicator
    if (player.stunTimer > 0) {
        ctx.fillStyle = 'rgba(255,0,0,0.3)';
        ctx.beginPath();
        ctx.arc(pX, bodyY - 30, 20, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', pX, bodyY - 35);
    }
    
    // Pushback indicator
    if (player.pushbackTimer > 0) {
        ctx.fillStyle = 'rgba(0,212,255,0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Distance indicator
    if (runner.distance > 0 && !runner.caught) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.floor(runner.distance)}m ahead`, pX, pY - 50);
    }
    
    // Controls hint (first few seconds)
    if (distance < 200) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(canvas.width / 2 - 150, 80, 300, 60);
        ctx.fillStyle = '#fff';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('↑/W = Jump  ↓/S = Slide  ←/→ = Switch Lanes', canvas.width / 2, 105);
        ctx.fillText('Catch the runner!', canvas.width / 2, 125);
    }
}

// ==================== GAME LOOP ====================
function gameLoop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;
    
    if (gameState === STATE.PLAYING) {
        update(dt);
        draw();
        requestAnimationFrame(gameLoop);
    } else if (gameState === STATE.PAUSED) {
        // Still draw but don't update
        draw();
    }
}

// Initial draw for menu background
function menuLoop() {
    if (gameState === STATE.MENU) {
        draw();
        requestAnimationFrame(menuLoop);
    }
}

// Start menu background
gameState = STATE.MENU;
lastTime = performance.now();
menuLoop();
