// === Main Game ===

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const countEl = document.getElementById('count');
const replayBtn = document.getElementById('replay');

let W, H, groundY;

function resize() {
  W = Math.min(window.innerWidth, 1200);
  H = Math.min(window.innerHeight, 700);
  canvas.width = W;
  canvas.height = H;
  groundY = H - 60;
}
resize();
window.addEventListener('resize', () => { resize(); if (!running) init(); });

// --- Particles ---
let particles = [];

class Particle {
  constructor(x, y, vx, vy, life, size, color, type = 'circle') {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
    this.size = size; this.color = color;
    this.type = type;
    this.active = true;
  }
  update(dt) {
    this.vy += 400 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0 || this.y > groundY + 50) this.active = false;
  }
  draw() {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = alpha;
    if (this.type === 'circle') {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'spark') {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.size;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - this.vx * 0.02, this.y - this.vy * 0.02);
      ctx.stroke();
    } else if (this.type === 'smoke') {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * (1 + (1 - alpha) * 2), 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'debris') {
      ctx.fillStyle = this.color;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.life * 5);
      ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

function spawnSparks(x, y, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 100 + Math.random() * 400;
    const colors = ['#ffdd00', '#ff8800', '#ff4400', '#ffffff', '#ffaa00'];
    particles.push(new Particle(
      x, y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed - 200,
      0.3 + Math.random() * 0.5,
      1 + Math.random() * 2,
      colors[Math.floor(Math.random() * colors.length)],
      'spark'
    ));
  }
}

function spawnSmoke(x, y, count) {
  for (let i = 0; i < count; i++) {
    const colors = ['#555', '#666', '#777', '#444', '#888'];
    particles.push(new Particle(
      x + (Math.random() - 0.5) * 30,
      y + (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 50,
      -30 - Math.random() * 80,
      0.8 + Math.random() * 1.5,
      5 + Math.random() * 10,
      colors[Math.floor(Math.random() * colors.length)],
      'smoke'
    ));
  }
}

function spawnDebris(x, y, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 0.8 - Math.PI * 0.4;
    const speed = 50 + Math.random() * 200;
    const colors = ['#333', '#444', '#555', '#222'];
    particles.push(new Particle(
      x, y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed - 100,
      1 + Math.random() * 2,
      2 + Math.random() * 4,
      colors[Math.floor(Math.random() * colors.length)],
      'debris'
    ));
  }
}

// --- Brick Wall ---
let bricks = [];
let bricksKnocked = 0;

function createBrickWall(startX, startY, cols, rows, brickW, brickH) {
  const wallBricks = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const offset = (row % 2) * (brickW / 2);
      const bx = startX + col * brickW + offset;
      const by = startY - row * brickH;
      const colors = ['#c0392b', '#a93226', '#b7410e', '#d35400', '#e74c3c', '#922b21'];
      const brick = new PhysicsBody(bx, by, brickW - 2, brickH - 2, 0.5, 0.2);
      brick.kinetic = false; // initially static
      brick.active = true;
      brick.brickColor = colors[Math.floor(Math.random() * colors.length)];
      brick.color = brick.brickColor;
      wallBricks.push(brick);
    }
  }
  return wallBricks;
}

// --- Car ---
let car = null;
let carAngle = 0;
let crashPhase = 0; // 0 = driving, 1 = impact, 2 = aftermath
let crashTime = 0;
let carSpeed = 0;

function createCar(x, y) {
  return {
    x, y, // logical position (not physics body)
    w: 120, h: 45,
    speed: 350,
    crumpleAmount: 0,
    damageParts: [],
    wheelAngle: 0,
    smokeTimer: 0,
    sparkTimer: 0
  };
}

// --- State ---
let running = false;
let lastTime = 0;
let wall = null;
let wallStartX = 0;
let wallBrickW = 30;
let wallBrickH = 16;
let wallCols = 8;
let wallRows = 8; // 64 bricks

function init() {
  resize();
  wallStartX = W * 0.65;
  wallBrickW = Math.min(30, (W * 0.35) / wallCols);
  wallBrickH = wallBrickW * 0.55;
  wall = createBrickWall(wallStartX, groundY, wallCols, wallRows, wallBrickW, wallBrickH);
  car = createCar(-150, groundY - 35);
  carSpeed = 350;
  crashPhase = 0;
  crashTime = 0;
  carAngle = 0;
  car.crumpleAmount = 0;
  car.damageParts = [];
  car.wheelAngle = 0;
  car.smokeTimer = 0;
  car.sparkTimer = 0;
  bricksKnocked = 0;
  particles = [];
  countEl.textContent = '0';
  lastTime = performance.now();
  running = true;
  requestAnimationFrame(gameLoop);
}

function drawSky() {
  // Gradient sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
  skyGrad.addColorStop(0, '#1a1a3e');
  skyGrad.addColorStop(0.4, '#2d2d6e');
  skyGrad.addColorStop(0.7, '#4a3f6b');
  skyGrad.addColorStop(1, '#6b4c6b');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, groundY);

  // Stars
  ctx.fillStyle = '#ffffff';
  const starSeed = 42;
  for (let i = 0; i < 50; i++) {
    const sx = ((i * 137 + starSeed) % W);
    const sy = ((i * 97 + starSeed * 3) % (groundY * 0.6));
    const ss = 0.5 + (i % 3) * 0.5;
    ctx.globalAlpha = 0.3 + (i % 5) * 0.15;
    ctx.beginPath();
    ctx.arc(sx, sy, ss, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawGround() {
  // Ground
  const groundGrad = ctx.createLinearGradient(0, groundY, 0, H);
  groundGrad.addColorStop(0, '#3d5a3d');
  groundGrad.addColorStop(0.15, '#2d4a2d');
  groundGrad.addColorStop(1, '#1a2a1a');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, groundY, W, H - groundY);

  // Road
  ctx.fillStyle = '#444';
  ctx.fillRect(0, groundY + 5, W, 40);

  // Road lines
  ctx.strokeStyle = '#ffcc00';
  ctx.lineWidth = 2;
  ctx.setLineDash([20, 15]);
  ctx.beginPath();
  ctx.moveTo(0, groundY + 25);
  ctx.lineTo(W, groundY + 25);
  ctx.stroke();
  ctx.setLineDash([]);

  // Road edges
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY + 6);
  ctx.lineTo(W, groundY + 6);
  ctx.moveTo(0, groundY + 44);
  ctx.lineTo(W, groundY + 44);
  ctx.stroke();
}

function drawBrick(brick) {
  if (!brick.active || !brick.knocked) return;
  ctx.save();
  ctx.translate(brick.pos.x, brick.pos.y);
  ctx.rotate(brick.angle);

  // Brick body
  ctx.fillStyle = brick.brickColor;
  ctx.fillRect(-brick.w/2, -brick.h/2, brick.w, brick.h);

  // Brick outline
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-brick.w/2, -brick.h/2, brick.w, brick.h);

  // Mortar lines
  ctx.strokeStyle = 'rgba(200,200,200,0.2)';
  ctx.beginPath();
  ctx.moveTo(-brick.w/2, 0);
  ctx.lineTo(brick.w/2, 0);
  ctx.stroke();

  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(-brick.w/2, -brick.h/2, brick.w, brick.h * 0.3);

  ctx.restore();
}

function drawCarBody(carObj, cx, cy) {
  const crumple = carObj.crumpleAmount;
  const frontX = cx + carObj.w/2;
  const bodyY = cy - carObj.h/2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(carAngle);

  // === Car body ===
  // Main body (lower)
  const bodyGrad = ctx.createLinearGradient(-carObj.w/2, bodyY, -carObj.w/2, bodyY + carObj.h);
  bodyGrad.addColorStop(0, '#e74c3c');
  bodyGrad.addColorStop(0.5, '#c0392b');
  bodyGrad.addColorStop(1, '#922b21');

  // Normal car body shape
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  // Bottom edge
  ctx.moveTo(-carObj.w/2 + 5, bodyY + carObj.h);
  ctx.lineTo(frontX - 10 - crumple * 30, bodyY + carObj.h);

  // Front (crumpled)
  if (crumple < 0.5) {
    const crumpleX = frontX - 10 - crumple * 30;
    ctx.lineTo(crumpleX + 5, bodyY + carObj.h - 5);
    ctx.lineTo(crumpleX, bodyY + 5);
    // Hood slope
    ctx.lineTo(crumpleX + 10, bodyY + carObj.h - 15);
  } else {
    const maxCrumple = 15;
    ctx.lineTo(frontX - 10 - maxCrumple, bodyY + carObj.h - 5);
    // Crumpled zigzag
    const zigCount = 3;
    for (let i = 0; i < zigCount; i++) {
      const zx = frontX - 10 - maxCrumple + (i + 1) * (maxCrumple / zigCount);
      const zy = bodyY + carObj.h - 5 - (i % 2 === 0 ? 8 : 0);
      ctx.lineTo(zx, zy);
    }
    ctx.lineTo(frontX - 10, bodyY + 5);
  }

  // Windshield
  ctx.lineTo(frontX - 25, bodyY + 5);
  ctx.lineTo(frontX - 45, bodyY - 20);

  // Roof
  ctx.lineTo(-carObj.w/2 + 35, bodyY - 20);

  // Rear window
  ctx.lineTo(-carObj.w/2 + 20, bodyY + 5);

  // Back
  ctx.lineTo(-carObj.w/2, bodyY + carObj.h - 5);
  ctx.lineTo(-carObj.w/2 + 5, bodyY + carObj.h);
  ctx.closePath();
  ctx.fill();

  // Body outline
  ctx.strokeStyle = '#7b241c';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // === Windows ===
  ctx.fillStyle = 'rgba(150, 200, 255, 0.6)';
  ctx.strokeStyle = 'rgba(100, 150, 200, 0.8)';
  ctx.lineWidth = 1;

  // Windshield
  ctx.beginPath();
  ctx.moveTo(frontX - 23, bodyY + 7);
  ctx.lineTo(frontX - 40, bodyY - 17);
  ctx.lineTo(frontX - 42, bodyY - 17);
  ctx.lineTo(-carObj.w/2 + 37, bodyY - 17);
  ctx.lineTo(-carObj.w/2 + 22, bodyY + 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Rear window
  ctx.fillStyle = 'rgba(150, 200, 255, 0.4)';
  ctx.beginPath();
  ctx.moveTo(-carObj.w/2 + 22, bodyY + 7);
  ctx.lineTo(-carObj.w/2 + 15, bodyY - 10);
  ctx.lineTo(-carObj.w/2 + 10, bodyY - 10);
  ctx.lineTo(-carObj.w/2 + 10, bodyY + 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // === Headlights ===
  if (crumple < 0.3) {
    ctx.fillStyle = '#ffff88';
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur = 10;
    ctx.fillRect(frontX - 8, bodyY + carObj.h - 18, 6, 10);
    ctx.shadowBlur = 0;
  }

  // === Tail lights ===
  ctx.fillStyle = '#ff3333';
  ctx.shadowColor = '#ff0000';
  ctx.shadowBlur = 5;
  ctx.fillRect(-carObj.w/2 + 2, bodyY + carObj.h - 18, 4, 10);
  ctx.shadowBlur = 0;

  // === Door handle ===
  ctx.fillStyle = '#888';
  ctx.fillRect(-5, bodyY + 15, 12, 3);

  // === Damage marks ===
  if (crumple > 0.1) {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    // Scratch marks on crumpled front
    for (let i = 0; i < 4; i++) {
      const sx = frontX - 15 - crumple * 20 + i * 5;
      ctx.beginPath();
      ctx.moveTo(sx, bodyY + 10);
      ctx.lineTo(sx + 3, bodyY + carObj.h - 10);
      ctx.stroke();
    }
  }

  // === Exhaust pipe ===
  ctx.fillStyle = '#555';
  ctx.fillRect(-carObj.w/2 - 5, bodyY + carObj.h - 8, 8, 4);

  ctx.restore();
}

function drawWheels(carObj, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(carAngle);

  const wheelR = 10;
  const wheelPositions = [
    { x: -carObj.w/2 + 22, y: carObj.h/2 },
    { x: carObj.w/2 - 20, y: carObj.h/2 }
  ];

  for (const wp of wheelPositions) {
    // Tire
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(wp.x, wp.y, wheelR, 0, Math.PI * 2);
    ctx.fill();

    // Rim
    ctx.fillStyle = '#666';
    ctx.beginPath();
    ctx.arc(wp.x, wp.y, wheelR - 3, 0, Math.PI * 2);
    ctx.fill();

    // Hub
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(wp.x, wp.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // Spokes
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    for (let s = 0; s < 5; s++) {
      const a = carObj.wheelAngle + s * Math.PI * 2 / 5;
      ctx.beginPath();
      ctx.moveTo(wp.x, wp.y);
      ctx.lineTo(wp.x + Math.cos(a) * (wheelR - 3), wp.y + Math.sin(a) * (wheelR - 3));
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawCar(carObj) {
  const cx = carObj.x;
  const cy = carObj.y;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, groundY - 2, carObj.w/2 + 5, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  drawCarBody(carObj, cx, cy);
  drawWheels(carObj, cx, cy);
}

function drawDamageParts(carObj) {
  for (const part of carObj.damageParts) {
    ctx.save();
    ctx.translate(part.x, part.y);
    ctx.rotate(part.angle);
    ctx.fillStyle = part.color;
    if (part.type === 'panel') {
      ctx.fillRect(-part.w/2, -part.h/2, part.w, part.h);
    } else if (part.type === 'light') {
      ctx.fillStyle = '#ffff88';
      ctx.fillRect(-part.w/2, -part.h/2, part.w, part.h);
      ctx.fillStyle = '#888';
      ctx.fillRect(-part.w/2 + 1, -part.h/2 + 1, part.w - 2, part.h/2);
    } else if (part.type === 'mirror') {
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(-part.w/2, -part.h/2, part.w, part.h);
      ctx.fillStyle = 'rgba(150,200,255,0.5)';
      ctx.fillRect(-part.w/2 + 2, -part.h/2 + 2, part.w - 4, part.h - 4);
    }
    ctx.restore();
  }
}

function spawnCrashEffects(x, y) {
  // Sparks
  spawnSparks(x, y, 40);
  // Smoke
  spawnSmoke(x, y, 25);
  // Debris
  spawnDebris(x, y, 15);
}

function update(dt) {
  // Update particles
  particles = particles.filter(p => p.active);
  for (const p of particles) p.update(dt);

  if (crashPhase === 0) {
    // Car driving
    car.x += car.speed * dt;
    car.wheelAngle += car.speed * dt * 0.05;

    // Small exhaust smoke
    car.smokeTimer += dt;
    if (car.smokeTimer > 0.15) {
      car.smokeTimer = 0;
      const exhaustX = car.x - car.w/2 - 5;
      const exhaustY = car.y + 5;
      const colors = ['#666', '#777', '#888'];
      particles.push(new Particle(
        exhaustX + (Math.random() - 0.5) * 5,
        exhaustY + (Math.random() - 0.5) * 3,
        -30 - Math.random() * 40,
        -10 - Math.random() * 20,
        0.4 + Math.random() * 0.3,
        3 + Math.random() * 4,
        colors[Math.floor(Math.random() * colors.length)],
        'smoke'
      ));
    }

    // Check for crash
    const carFront = car.x + car.w/2;
    const wallLeft = wallStartX - wallBrickW/2;

    if (carFront >= wallLeft) {
      crashPhase = 1;
      crashTime = 0;
      // Activate all bricks
      for (const brick of wall) {
        brick.kinetic = true;
        brick.active = true;
      }
      // Apply initial impulse to bricks
      for (const brick of wall) {
        const dist = Math.abs(brick.pos.x - carFront);
        const force = Math.max(0, 1 - dist / 200);
        if (force > 0) {
          brick.vel.x = -force * 600 + (Math.random() - 0.5) * 100;
          brick.vel.y = -force * 400 - Math.random() * 200;
          brick.angularVel = (Math.random() - 0.5) * 8;
        }
      }
      // Car slows down
      carSpeed = 50;
      // Effects
      spawnCrashEffects(carFront, car.y);
      // Damage parts
      car.damageParts.push({
        x: carFront, y: car.y - 15,
        vx: -80 + Math.random() * -60,
        vy: -150 - Math.random() * 100,
        angle: 0,
        angularVel: (Math.random() - 0.5) * 10,
        w: 8, h: 12, type: 'light', color: '#ffff88'
      });
      car.damageParts.push({
        x: carFront - 10, y: car.y - 25,
        vx: -100 + Math.random() * -40,
        vy: -180 - Math.random() * 80,
        angle: 0,
        angularVel: (Math.random() - 0.5) * 12,
        w: 10, h: 8, type: 'mirror', color: '#c0392b'
      });
      car.damageParts.push({
        x: carFront + 5, y: car.y + 10,
        vx: -60 + Math.random() * -30,
        vy: -100 - Math.random() * 60,
        angle: 0,
        angularVel: (Math.random() - 0.5) * 8,
        w: 20, h: 6, type: 'panel', color: '#c0392b'
      });
    }
  } else if (crashPhase >= 1) {
    crashTime += dt;

    // Car crumples over time
    car.crumpleAmount = Math.min(1, crashTime * 0.8);

    // Car slows and stops
    carSpeed = Math.max(0, carSpeed - 200 * dt);
    car.x += carSpeed * dt;
    car.wheelAngle += carSpeed * dt * 0.05;

    // Car bounces slightly then settles
    if (crashTime < 0.3) {
      carAngle = -crashTime * 0.3;
    } else {
      carAngle *= 0.9;
    }

    // Continuous sparks for a bit
    if (crashTime < 0.5) {
      car.sparkTimer += dt;
      if (car.sparkTimer > 0.05) {
        car.sparkTimer = 0;
        const sparkX = car.x + car.w/2 - car.crumpleAmount * 30;
        spawnSparks(sparkX, car.y, 3);
      }
    }

    // Smoke continues
    if (crashTime < 2) {
      car.smokeTimer += dt;
      if (car.smokeTimer > 0.3) {
        car.smokeTimer = 0;
        const smokeX = car.x + car.w/2 - car.crumpleAmount * 20;
        spawnSmoke(smokeX, car.y - 10, 3);
      }
    }

    // Update damage parts
    for (const part of car.damageParts) {
      part.vy += 600 * dt;
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.angle += part.angularVel * dt;
      part.angularVel *= 0.98;
      if (part.y > groundY) {
        part.y = groundY;
        part.vy *= -0.3;
        part.vx *= 0.7;
        if (Math.abs(part.vy) < 10) part.vy = 0;
      }
    }
  }

  // Update bricks physics
  for (const brick of wall) {
    if (!brick.kinetic) continue;
    brick.update(dt);
    brick.resolveGround(groundY);
    brick.resolveWall(wallStartX - wallBrickW * 2); // left wall boundary

    // Brick-brick collisions
    for (const other of wall) {
      if (brick === other) continue;
      if (!other.kinetic) continue;
      resolveCollision(brick, other, groundY);
    }
  }

  // Count knocked bricks
  let newKnocked = 0;
  for (const brick of wall) {
    if (brick.knocked && brick.pos.y > groundY - 100) {
      newKnocked++;
    }
    // Also count if fallen off screen or moved significantly
    if (brick.pos.x < wallStartX - wallBrickW * 3 || brick.pos.y > groundY + 10) {
      newKnocked++;
    }
  }
  // Count all bricks that are no longer in their original position
  for (const brick of wall) {
    if (!brick.knocked && brick.kinetic) {
      const origX = brick.pos.x; // We can't easily track original, so use displacement
      if (Math.abs(brick.vel.x) > 10 || Math.abs(brick.vel.y) > 10) {
        brick.knocked = true;
      }
    }
  }
  bricksKnocked = wall.filter(b => b.knocked).length;
  countEl.textContent = bricksKnocked;
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  drawSky();
  drawGround();

  // Draw bricks (static ones behind, kinetic ones on top)
  for (const brick of wall) {
    if (!brick.kinetic) {
      drawBrick(brick);
    }
  }

  // Draw car
  drawCar(car);

  // Draw damage parts
  drawDamageParts(car);

  // Draw kinetic bricks on top
  for (const brick of wall) {
    if (brick.kinetic) {
      drawBrick(brick);
    }
  }

  // Draw particles
  for (const p of particles) {
    p.draw();
  }

  // Crash text
  if (crashPhase === 1 && crashTime < 0.5) {
    ctx.save();
    ctx.globalAlpha = 1 - crashTime / 0.5;
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 10;
    ctx.fillText('CRASH!', W/2, H/2 - 50);
    ctx.restore();
  }
}

function gameLoop(timestamp) {
  if (!running) return;

  const dt = Math.min((timestamp - lastTime) / 1000, 0.033); // cap at ~30fps min
  lastTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(gameLoop);
}

// --- Replay ---
replayBtn.addEventListener('click', () => {
  init();
});

// --- Start ---
init();
