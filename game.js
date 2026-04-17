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
let laneX = 0; // actual X position (smooth movement)
let scrollY = 0; // how far we've run
let speed = 8;

// Camera/view settings
const horizonY = 180; // where sky meets ground
const groundStartY = canvas.height - 100; // where Norm stands

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
// x = left/right in world, z = distance into screen (0 = close, 1000 = far)
function project(x, z) {
    const centerX = canvas.width / 2;
    
    // Scale: things get smaller as they go further away (higher z)
    // z=0 is at Norm's position (close), z=1000 is at horizon (far)
    const scale = 200 / (200 + z);
    
    const screenX = centerX + (x * scale);
    
    // Y position: z=0 is at bottom of screen (near), z=1000 is at horizonY (far)
    const screenY = groundStartY - (z * scale * 0.5);
    
    return { x: screenX, y: screenY, scale: scale };
}

// Draw sky and city background
function drawBackground() {
    const w = canvas.width;
    const h = canvas.height;
    
    // Sky gradient (night city)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGrad.addColorStop(0, '#0a0a1a');
    skyGrad.addColorStop(0.5, '#1a1a3e');
    skyGrad.addColorStop(1, '#2d3561');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, horizonY);
    
    // Distant city skyline (simple blocks)
    ctx.fillStyle = '#1a1a2e';
    for (let i = 0; i < 15; i++) {
        const buildingX = (i * w / 12) - 50;
        const buildingH = 30 + Math.sin(i * 3) * 20 + Math.random() * 40;
        ctx.fillRect(buildingX, horizonY - buildingH, 60, buildingH);
    }
    
    // City lights (windows)
    ctx.fillStyle = '#f1c40f';
    for (let i = 0; i < 50; i++) {
        const lx = Math.random() * w;
        const ly = horizonY - 20 - Math.random() * 60;
        ctx.fillRect(lx, ly, 3, 3);
    }
    
    // Moon
    ctx.fillStyle = '#f5f5f5';
    ctx.beginPath();
    ctx.arc(w - 100, 60, 30, 0, Math.PI * 2);
    ctx.fill();
    
    // Ground (dark pavement)
    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, horizonY, w, h - horizonY);
}

// Draw the 3D lane grid
function drawLanes() {
    const laneWidth = 150; // width at closest point
    
    // Vertical lane lines (converging to vanishing point)
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 3;
    
    for (let i = 0; i <= 3; i++) {
        const x = (i - 1.5) * laneWidth;
        
        // Draw from near (z=0) to far (z=1000)
        const near = project(x, 0);
        const far = project(x, 1000);
        
        ctx.beginPath();
        ctx.moveTo(near.x, near.y);
        ctx.lineTo(far.x, far.y);
        ctx.stroke();
    }
    
    // Horizontal moving lines (show speed)
    ctx.strokeStyle = '#3d5a80';
    ctx.lineWidth = 2;
    
    for (let i = 0; i < 15; i++) {
        // Moving z position based on scroll
        let z = ((i * 80) - scrollY) % 1000;
        if (z < 0) z += 1000;
        
        const left = project(-laneWidth * 1.5, z);
        const right = project(laneWidth * 1.5, z);
        
        // Fade out near horizon
        const alpha = 1 - (z / 1000);
        ctx.strokeStyle = `rgba(61, 90, 128, ${alpha})`;
        
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.lineTo(right.x, right.y);
        ctx.stroke();
    }
}

// Draw Norm as a human character (at bottom of screen, facing away)
function drawNorm() {
    // Smooth lane transition
    const targetX = (lane - 1) * 150;
    laneX += (targetX - laneX) * 0.12;
    
    // Position at bottom of screen (z=0 = close to camera)
    const pos = project(laneX, 0);
    const s = pos.scale; // scale factor (larger = closer)
    const x = pos.x;
    const y = pos.y;
    
    // Running bob animation
    const bob = Math.sin(Date.now() / 80) * 8;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(x, y + 5, 35 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Running leg animation
    const runCycle = Date.now() / 60;
    const leftLegOffset = Math.sin(runCycle) * 20;
    const rightLegOffset = Math.sin(runCycle + Math.PI) * 20;
    const leftKnee = Math.abs(Math.sin(runCycle)) * 15;
    const rightKnee = Math.abs(Math.sin(runCycle + Math.PI)) * 15;
    
    // Left leg (back leg when running)
    ctx.fillStyle = '#2c3e50'; // Dark navy pants
    // Thigh
    ctx.fillRect(x - 15 * s + leftLegOffset * s * 0.3, y - 70 * s + bob, 12 * s, 35 * s);
    // Shin
    ctx.fillRect(x - 15 * s + leftLegOffset * s, y - 40 * s + bob + leftKnee * s, 10 * s, 35 * s);
    
    // Right leg
    ctx.fillRect(x + 3 * s + rightLegOffset * s * 0.3, y - 70 * s + bob, 12 * s, 35 * s);
    ctx.fillRect(x + 3 * s + rightLegOffset * s, y - 40 * s + bob + rightKnee * s, 10 * s, 35 * s);
    
    // Shoes
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x - 18 * s + leftLegOffset * s, y - 8 * s + bob, 14 * s, 10 * s);
    ctx.fillRect(x + 3 * s + rightLegOffset * s, y - 8 * s + bob, 14 * s, 10 * s);
    
    // Torso (tan security shirt)
    ctx.fillStyle = '#c9a86c';
    ctx.fillRect(x - 22 * s, y - 110 * s + bob, 44 * s, 50 * s);
    
    // Belt
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x - 22 * s, y - 65 * s + bob, 44 * s, 10 * s);
    
    // Gold belt buckle
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(x - 6 * s, y - 65 * s + bob, 12 * s, 10 * s);
    
    // Fanny pack (from your design!)
    ctx.fillStyle = '#34495e';
    ctx.fillRect(x - 18 * s, y - 58 * s + bob, 36 * s, 18 * s);
    ctx.strokeStyle = '#95a5a6';
    ctx.lineWidth = 2 * s;
    ctx.strokeRect(x - 18 * s, y - 58 * s + bob, 36 * s, 18 * s);
    
    // Security patch on back
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x - 12 * s, y - 100 * s + bob, 24 * s, 16 * s);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${7 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('NORM', x, y - 90 * s + bob);
    
    // Arms (swinging opposite to legs)
    const armSwing = Math.sin(runCycle) * 25;
    
    // Left arm
    ctx.fillStyle = '#c9a86c';
    ctx.fillRect(x - 32 * s - armSwing * s * 0.5, y - 105 * s + bob, 10 * s, 30 * s);
    ctx.fillRect(x - 32 * s - armSwing * s, y - 80 * s + bob, 8 * s, 25 * s);
    
    // Right arm
    ctx.fillRect(x + 22 * s + armSwing * s * 0.5, y - 105 * s + bob, 10 * s, 30 * s);
    ctx.fillRect(x + 24 * s + armSwing * s, y - 80 * s + bob, 8 * s, 25 * s);
    
    // Hands
    ctx.fillStyle = '#e8c4a0';
    ctx.beginPath();
    ctx.arc(x - 32 * s - armSwing * s, y - 55 * s + bob, 6 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 28 * s + armSwing * s, y - 55 * s + bob, 6 * s, 0, Math.PI * 2);
    ctx.fill();
    
    // Head
    ctx.fillStyle = '#e8c4a0'; // Skin tone
    ctx.beginPath();
    ctx.arc(x, y - 125 * s + bob, 16 * s, 0, Math.PI * 2);
    ctx.fill();
    
    // Hair (short, receding, brown)
    ctx.fillStyle = '#5d4e37';
    ctx.beginPath();
    ctx.arc(x, y - 130 * s + bob, 14 * s, 0, Math.PI, true);
    ctx.fill();
    // Side hair
    ctx.fillRect(x - 14 * s, y - 130 * s + bob, 6 * s, 15 * s);
    ctx.fillRect(x + 8 * s, y - 130 * s + bob, 6 * s, 15 * s);
    
    // Big bushy mustache (from your design notes!)
    ctx.fillStyle = '#4a3c2a';
    ctx.beginPath();
    ctx.ellipse(x, y - 118 * s + bob, 10 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Ears
    ctx.fillStyle = '#e8c4a0';
    ctx.beginPath();
    ctx.arc(x - 16 * s, y - 125 * s + bob, 4 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 16 * s, y - 125 * s + bob, 4 * s, 0, Math.PI * 2);
    ctx.fill();
}

// Main game loop
function gameLoop() {
    // Update scroll (ground moves toward camera)
    scrollY += speed;
    if (scrollY > 1000) scrollY = 0;
    
    // Clear screen
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw everything in order (back to front)
    drawBackground();
    drawLanes();
    drawNorm();
    
    requestAnimationFrame(gameLoop);
}

// Start
gameLoop();
