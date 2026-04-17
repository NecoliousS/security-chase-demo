// Get the canvas and make it fill the screen
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Make canvas match window size
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// Game variables
let lane = 1; // 0 = left, 1 = center, 2 = right
let scrollY = 0; // How far we've scrolled

// Draw the three lanes
function drawLanes() {
    const w = canvas.width;
    const h = canvas.height;
    const laneWidth = w / 3;
    
    // Background
    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, 0, w, h);
    
    // Lane dividers
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(laneWidth, 0);
    ctx.lineTo(laneWidth, h);
    ctx.moveTo(laneWidth * 2, 0);
    ctx.lineTo(laneWidth * 2, h);
    ctx.stroke();
    
    // Lane markers (moving to show scroll)
    ctx.fillStyle = '#e94560';
    for (let i = -1; i < 5; i++) {
        let y = ((i * 100) + scrollY) % h;
        ctx.fillRect(laneWidth - 5, y, 10, 50);
        ctx.fillRect(laneWidth * 2 - 5, y, 10, 50);
    }
}

// Draw the player (Norm) - just a rectangle for now
function drawPlayer() {
    const w = canvas.width;
    const h = canvas.height;
    const laneWidth = w / 3;
    const x = (lane * laneWidth) + (laneWidth / 2) - 25;
    const y = h - 150;
    
    // Norm's body
    ctx.fillStyle = '#d4a574'; // Tan shirt color
    ctx.fillRect(x, y, 50, 80);
    
    // Head
    ctx.fillStyle = '#f5d5b0'; // Skin
    ctx.fillRect(x + 10, y - 30, 30, 30);
    
    // Label
    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('NORM', x + 25, y + 100);
}

// Handle input
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' && lane > 0) {
        lane--;
    }
    if (e.key === 'ArrowRight' && lane < 2) {
        lane++;
    }
});

// Touch support for mobile
canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    const w = window.innerWidth;
    if (touch.clientX < w / 2 && lane > 0) {
        lane--;
    } else if (touch.clientX > w / 2 && lane < 2) {
        lane++;
    }
});

// Main game loop
function gameLoop() {
    // Move the world
    scrollY += 5;
    if (scrollY > 100) scrollY = 0;
    
    // Clear and redraw
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawLanes();
    drawPlayer();
    
    requestAnimationFrame(gameLoop);
}

// Start the game
gameLoop();
