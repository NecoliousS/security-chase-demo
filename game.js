// Get the canvas
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Make canvas match window size
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// Game state
let lane = 1; // 0 = left, 1 = center, 2 = right
let laneTarget = 1; // where we're moving to
let laneX = 0; // actual X position (for smooth movement)
let scrollY = 0; // how far we've run
let speed = 8;

// Camera/view settings (3D perspective)
const horizonY = 150; // where the sky meets the ground
const groundHeight = canvas.height - horizonY;

// Norm's 3D position
let normX = 0; // calculated from lane
let normZ = 0; // distance into the screen (0 = close, higher = further)

// Input handling
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' && lane > 0) {
        lane--;
    }
    if (e.key === 'ArrowRight' && lane < 2) {
        lane++;
    }
});

// Touch controls
canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    const w = window.innerWidth;
    if (touch.clientX < w / 2 && lane > 0) {
        lane--;
    } else if (touch.clientX > w / 2 && lane < 2) {
        lane++;
    }
});

// Convert 3D world position to 2D screen position
function project(x, z) {
    const centerX = canvas.width / 2;
    const vanishingPointY = horizonY;
    
    // Scale gets smaller as things go further away (higher z)
    const scale = 300 / (300 + z);
    
    const screenX = centerX + (x * scale);
    const screenY = vanishingPointY + (z * scale);
    
    return { x: screenX, y: screenY, scale: scale };
}

// Draw the 3D ground with lanes
function drawGround() {
    const w = canvas.width;
    const h = canvas.height;
    
    // Sky
    ctx.fillStyle = '#0f0f23';
    ctx.fillRect(0, 0, w, horizonY);
    
    // Ground (dark blue)
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, horizonY, w, h - horizonY);
    
    // Lane lines (converging to vanishing point)
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 2;
    
    const laneWidth = 120; // width at closest point
    
    for (let i = 0; i <= 3; i++) {
        const x = (i - 1.5) * laneWidth;
        
        // Draw line from horizon to bottom
        const top = project(x, 10);
        const bottom = project(x, 400);
        
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(bottom.x, bottom.y);
        ctx.stroke();
    }
    
    // Moving horizontal lines to show speed
    ctx.strokeStyle = '#2d3561';
    for (let i = 0; i < 10; i++) {
        let z = ((i * 40) - scrollY) % 400;
        if (z < 10) z += 400;
        
        const left = project(-laneWidth * 1.5, z);
        const right = project(laneWidth * 1.5, z);
        
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.lineTo(right.x, right.y);
        ctx.stroke();
    }
}

// Draw Norm as a human character (from behind, running)
function drawNorm() {
    // Smooth lane transition
    const targetX = (lane - 1) * 120;
    laneX += (targetX - laneX) * 0.15;
    
    // Position Norm in the scene
    const pos = project(laneX, 20);
    const s = pos.scale;
    const x = pos.x;
    const y = pos.y;
    
    // Running bob animation
    const bob = Math.sin(Date.now() / 100) * 5 * s;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y, 30 * s, 10 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Legs (running pose)
    const legOffset = Math.sin(Date.now() / 80) * 15;
    
    // Left leg
    ctx.fillStyle = '#2c3e50'; // Dark pants
    ctx.fillRect(x - 12 * s + legOffset * s, y - 60 * s + bob, 10 * s, 35 * s);
    
    // Right leg  
    ctx.fillRect(x + 2 * s - legOffset * s, y - 60 * s + bob, 10 * s, 35 * s);
    
    // Torso (tan security shirt)
    ctx.fillStyle = '#d4a574';
    ctx.fillRect(x - 18 * s, y - 95 * s + bob, 36 * s, 40 * s);
    
    // Belt
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(x - 18 * s, y - 60 * s + bob, 36 * s, 8 * s);
    
    // Belt buckle
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(x - 5 * s, y - 60 * s + bob, 10 * s, 8 * s);
    
    // Arms (swinging)
    const armSwing = Math.sin(Date.now() / 80) * 20;
    
    // Left arm
    ctx.fillStyle = '#d4a574';
    ctx.fillRect(x - 28 * s - armSwing * s, y - 90 * s + bob, 10 * s, 30 * s);
    
    // Right arm
    ctx.fillRect(x + 18 * s + armSwing * s, y - 90 * s + bob, 10 * s, 30 * s);
    
    // Head
    ctx.fillStyle = '#f5d5b0'; // Skin tone
    ctx.beginPath();
    ctx.arc(x, y - 108 * s + bob, 14 * s, 0, Math.PI * 2);
    ctx.fill();
    
    // Hair (short, receding)
    ctx.fillStyle = '#8b7355';
    ctx.beginPath();
    ctx.arc(x, y - 112 * s + bob, 12 * s, 0, Math.PI, true);
    ctx.fill();
    
    // Big bushy mustache (from your design notes!)
    ctx.fillStyle = '#5d4e37';
    ctx.beginPath();
    ctx.ellipse(x, y - 102 * s + bob, 8 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Security patch on back
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(x - 8 * s, y - 88 * s + bob, 16 * s, 12 * s);
    ctx.fillStyle = '#fff';
    ctx.font = `${6 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('NORM', x, y - 80 * s + bob);
    
    // Fanny pack (from your design!)
    ctx.fillStyle = '#34495e';
    ctx.fillRect(x - 15 * s, y - 55 * s + bob, 30 * s, 15 * s);
    ctx.strokeStyle = '#95a5a6';
    ctx.lineWidth = 1 * s;
    ctx.strokeRect(x - 15 * s, y - 55 * s + bob, 30 * s, 15 * s);
}

// Main game loop
function gameLoop() {
    // Update scroll
    scrollY += speed;
    if (scrollY > 400) scrollY = 0;
    
    // Clear screen
    ctx.fillStyle = '#0f0f23';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw everything
    drawGround();
    drawNorm();
    
    requestAnimationFrame(gameLoop);
}

// Start
gameLoop();
