const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const counterEl = document.getElementById('counter');
const replayBtn = document.getElementById('replayBtn');

// Physics constants
const GRAVITY = 0.5;
const FRICTION = 0.98;
const BOUNCE = 0.7;
const GROUND_Y = 350;

// Game state
let bricks = [];
let particles = [];
let car = null;
let bricksKnocked = 0;
let animationId = null;
let gameStarted = false;

// Brick class
class Brick {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.vx = 0;
        this.vy = 0;
        this.rotation = 0;
        this.vr = 0;
        this.active = true;
        this.color = `hsl(${Math.random() * 30 + 10}, 70%, 50%)`;
    }

    update() {
        if (!this.active) return;
        
        this.vy += GRAVITY;
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.vr;
        
        // Friction
        this.vx *= FRICTION;
        this.vr *= 0.98;
        
        // Ground collision
        if (this.y + this.h/2 > GROUND_Y) {
            this.y = GROUND_Y - this.h/2;
            this.vy *= -BOUNCE;
            this.vx *= 0.9;
            this.vr *= 0.9;
            
            if (Math.abs(this.vy) < 1) this.vy = 0;
        }
        
        // Wall collisions
        if (this.x - this.w/2 < 0) {
            this.x = this.w/2;
            this.vx *= -BOUNCE;
        }
        if (this.x + this.w/2 > canvas.width) {
            this.x = canvas.width - this.w/2;
            this.vx *= -BOUNCE;
        }
    }

    draw() {
        if (!this.active) return;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.w/2, -this.h/2, this.w, this.h);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(-this.w/2, -this.h/2, this.w, this.h);
        ctx.restore();
    }
}

// Particle class for sparks/smoke
class Particle {
    constructor(x, y, vx, vy, color, life) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = Math.random() * 3 + 1;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += GRAVITY * 0.5;
        this.life--;
    }

    draw() {
        const alpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.globalAlpha = 1;
    }

    isAlive() {
        return this.life > 0;
    }
}

// Car class
class Car {
    constructor() {
        this.x = 100;
        this.y = GROUND_Y - 30;
        this.vx = 3;
        this.vy = 0;
        this.speed = 3;
        this.crumped = false;
        this.crumpAmount = 0;
        this.damageParts = [];
        this.wheelRotation = 0;
        
        // Define car parts for damage
        this.frontBumper = { x: this.x + 35, y: this.y + 5, w: 20, h: 15 };
        this.headlight = { x: this.x + 50, y: this.y - 5, w: 8, h: 8 };
    }

    update() {
        if (!this.crumped) {
            this.x += this.speed;
            this.wheelRotation += 0.2;
        } else {
            // Slow down after crash
            this.speed *= 0.95;
            this.x += this.speed;
            this.wheelRotation += this.speed * 0.1;
            
            // Increase crump amount
            if (this.crumpAmount < 20) {
                this.crumpAmount += 0.5;
            }
        }
        
        // Generate sparks on impact
        if (this.crumped && this.speed > 0.5) {
            for (let i = 0; i < 3; i++) {
                particles.push(new Particle(
                    this.x + 40,
                    this.y + 5,
                    Math.random() * 4 + 2,
                    -Math.random() * 3,
                    Math.random() > 0.5 ? '#ffaa00' : '#ffff00',
                    30 + Math.random() * 20
                ));
            }
        }
    }

    draw() {
        ctx.save();
        
        // Car body
        ctx.fillStyle = '#e74c3c';
        
        // Main body (with crumple effect)
        const bodyY = this.y;
        const bodyH = 30;
        const bodyW = 60;
        
        // Draw main body
        ctx.beginPath();
        if (this.crumped) {
            // Crumpled front
            ctx.moveTo(this.x - bodyW/2, bodyY);
            ctx.lineTo(this.x - bodyW/2 + this.crumpAmount, bodyY - 5);
            ctx.lineTo(this.x + bodyW/2, bodyY - 5);
            ctx.lineTo(this.x + bodyW/2, bodyY + bodyH);
            ctx.lineTo(this.x - bodyW/2, bodyY + bodyH);
            ctx.closePath();
        } else {
            ctx.fillRect(this.x - bodyW/2, bodyY, bodyW, bodyH);
        }
        ctx.fill();
        
        // Car top
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        if (this.crumped) {
            ctx.moveTo(this.x - 15, bodyY - 5);
            ctx.lineTo(this.x + 20, bodyY - 5);
            ctx.lineTo(this.x + 25, bodyY - 25);
            ctx.lineTo(this.x - 20, bodyY - 25);
            ctx.closePath();
        } else {
            ctx.fillRect(this.x - 20, bodyY - 25, 45, 25);
        }
        ctx.fill();
        
        // Wheels
        ctx.fillStyle = '#222';
        const wheelY = bodyY + bodyH;
        const wheelRadius = 8;
        
        // Left wheel
        ctx.beginPath();
        ctx.arc(this.x - 20, wheelY, wheelRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Right wheel
        ctx.beginPath();
        ctx.arc(this.x + 20, wheelY, wheelRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Wheel spokes
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
            const angle = this.wheelRotation + i * Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(this.x - 20, wheelY);
            ctx.lineTo(this.x - 20 + Math.cos(angle) * wheelRadius, wheelY + Math.sin(angle) * wheelRadius);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(this.x + 20, wheelY);
            ctx.lineTo(this.x + 20 + Math.cos(angle) * wheelRadius, wheelY + Math.sin(angle) * wheelRadius);
            ctx.stroke();
        }
        
        // Headlight (may break off)
        if (!this.damageParts.includes('headlight')) {
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(this.x + 35, bodyY - 8, 8, 8);
        }
        
        // Front bumper (may crumple/break)
        if (!this.damageParts.includes('bumper')) {
            ctx.fillStyle = '#555';
            if (this.crumped) {
                ctx.beginPath();
                ctx.moveTo(this.x + bodyW/2, bodyY);
                ctx.quadraticCurveTo(this.x + bodyW/2 + 10, bodyY - 5, this.x + bodyW/2, bodyY - 10);
                ctx.lineTo(this.x + bodyW/2, bodyY + bodyH);
                ctx.closePath();
                ctx.fill();
            } else {
                ctx.fillRect(this.x + bodyW/2 - 2, bodyY, 4, bodyH);
            }
        }
        
        ctx.restore();
    }

    crash() {
        this.crumped = true;
        // Add damage parts
        if (!this.damageParts.includes('bumper')) {
            this.damageParts.push('bumper');
        }
        if (!this.damageParts.includes('headlight')) {
            this.damageParts.push('headlight');
        }
    }
}

// Initialize brick wall
function initBricks() {
    bricks = [];
    const brickW = 40;
    const brickH = 20;
    const columns = 8;
    const rows = 6;
    
    const startX = 500;
    const startY = GROUND_Y - brickH;
    
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
            const x = startX + col * brickW;
            const y = startY - row * brickH;
            bricks.push(new Brick(x, y, brickW, brickH));
        }
    }
}

// Initialize car
function initCar() {
    car = new Car();
}

// Initialize particles
function initParticles() {
    particles = [];
}

// Reset game
function resetGame() {
    initBricks();
    initCar();
    initParticles();
    bricksKnocked = 0;
    counterEl.textContent = `Bricks knocked: ${bricksKnocked}`;
    gameStarted = true;
    
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    animate();
}

// Check collisions between car and bricks
function checkCollisions() {
    if (!car || !car.crumped) return;
    
    bricks.forEach(brick => {
        if (!brick.active) return;
        
        // Simple AABB collision
        if (car.x + 30 > brick.x - brick.w/2 && 
            car.x - 30 < brick.x + brick.w/2 &&
            car.y + 15 > brick.y - brick.h/2 && 
            car.y - 15 < brick.y + brick.h/2) {
            
            // Brick gets hit
            brick.active = false;
            brick.vx = (Math.random() - 0.5) * 10 + 5;
            brick.vy = -Math.random() * 8 - 2;
            brick.vr = (Math.random() - 0.5) * 0.2;
            
            bricksKnocked++;
            counterEl.textContent = `Bricks knocked: ${bricksKnocked}`;
            
            // Add smoke particles
            for (let i = 0; i < 5; i++) {
                particles.push(new Particle(
                    brick.x,
                    brick.y,
                    (Math.random() - 0.5) * 3,
                    -Math.random() * 2,
                    '#888',
                    40 + Math.random() * 20
                ));
            }
        }
    });
}

// Draw ground
function drawGround() {
    ctx.fillStyle = '#555';
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);
    
    // Ground line
    ctx.strokeStyle = '#777';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(canvas.width, GROUND_Y);
    ctx.stroke();
}

// Draw sky/background
function drawBackground() {
    // Sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, GROUND_Y);
}

// Main animation loop
function animate() {
    drawBackground();
    drawGround();
    
    // Update and draw bricks
    bricks.forEach(brick => {
        brick.update();
        brick.draw();
    });
    
    // Update and draw particles
    particles = particles.filter(p => p.isAlive());
    particles.forEach(p => {
        p.update();
        p.draw();
    });
    
    // Update and draw car
    if (car) {
        car.update();
        car.draw();
        
        // Check collisions after car starts crashing
        if (car.crumped) {
            checkCollisions();
        }
    }
    
    animationId = requestAnimationFrame(animate);
}

// Start animation on page load
replayBtn.addEventListener('click', resetGame);

// Initialize and start
resetGame();