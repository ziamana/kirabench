/* ============================================================
   Car Crash — Brick Smash
   Pure 2D physics on a canvas. No libraries, no images.
   ============================================================ */
(function () {
  "use strict";

  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  const counterEl = document.getElementById("counter");
  const replayBtn = document.getElementById("replay");

  const W = canvas.width;
  const H = canvas.height;
  const GROUND_Y = H - 58;          // top of the road
  const GRAVITY = 1500;             // px/s^2

  let bricks = [];
  let debris = [];
  let sparks = [];
  let smoke = [];
  let knocked = 0;
  let crashed = false;
  let car = null;
  let last = 0;

  /* --------------------- geometry helpers ------------------- */
  function corners(b) {
    const c = Math.cos(b.angle), s = Math.sin(b.angle);
    const ox = b.x, oy = b.y, hw = b.w / 2, hh = b.h / 2;
    return [
      { x: ox - c * hw + s * hh, y: oy - s * hw - c * hh },
      { x: ox + c * hw + s * hh, y: oy + s * hw - c * hh },
      { x: ox + c * hw - s * hh, y: oy + s * hw + c * hh },
      { x: ox - c * hw - s * hh, y: oy - s * hw + c * hh },
    ];
  }
  function axisOf(b, i) {
    const a = corners(b)[i];
    const d = corners(b)[(i + 1) % 4];
    return { x: d.x - a.x, y: d.y - a.y };
  }
  function project(pts, ax) {
    let mn = Infinity, mx = -Infinity;
    for (const p of pts) { const d = p.x * ax.x + p.y * ax.y; if (d < mn) mn = d; if (d > mx) mx = d; }
    return { min: mn, max: mx };
  }

  /* SAT collision between two boxes, returns separating normal + depth */
  function satCollide(a, b) {
    let minPen = Infinity, normal = null;
    const axes = [axisOf(a, 0), axisOf(a, 1), axisOf(b, 0), axisOf(b, 1)];
    for (const ax of axes) {
      const pa = project(corners(a), ax), pb = project(corners(b), ax);
      if (pa.max < pb.min || pb.max < pa.min) return null;          // separated
      const pen = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);
      if (pen < minPen) { minPen = pen; normal = { x: ax.x, y: ax.y }; }
    }
    // normalize
    const len = Math.hypot(normal.x, normal.y) || 1;
    return { normal: { x: normal.x / len, y: normal.y / len }, depth: minPen };
  }

  /* --------------------- scene setup ------------------------ */
  function buildBricks() {
    bricks = [];
    const brickW = 46, brickH = 22, gap = 3;
    const cols = 8, rows = 6;
    const wallW = cols * brickW + (cols - 1) * gap;
    const wallH = rows * brickH + (rows - 1) * gap;
    const left = W - wallW - 34;
    const top = GROUND_Y - wallH;

    const shades = ["#b5442f", "#c0503a", "#a83c28", "#c9573f", "#b04530", "#cd6145"];
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // stagger every other row for a brick-wall look
        const cx = left + c * (brickW + gap) + ((r % 2) * (brickW / 2));
        const cy = top + r * (brickH + gap);
        bricks.push({
          x: cx, y: cy, w: brickW, h: brickH,
          vx: 0, vy: 0,
          ax: 0, ay: 0,
          angle: 0, av: 0,
          shade: shades[idx % shades.length],
          idx: idx++,
          knocked: false,
        });
      }
    }
  }

  function newCar() {
    return {
      x: 70, y: GROUND_Y - 40,
      w: 130, h: 52,
      vx: 430, vy: 0,
      angle: 0, av: 0,
      crumple: 0,        // 0..70 front crumple
      alive: true,
      headlight: true,   // detaches on heavy damage
    };
  }

  function reset() {
    buildBricks();
    car = newCar();
    debris = []; sparks = []; smoke = [];
    knocked = 0; crashed = false;
    counterEl.textContent = "Bricks knocked: 0";
  }

  /* --------------------- effects ---------------------------- */
  function emitSparks(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
      const sp = 200 + Math.random() * 520;
      sparks.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.5, max: 0.8,
        color: Math.random() < 0.5 ? "#ffe27a" : "#ff9d3c",
        size: 1.5 + Math.random() * 2.5,
      });
    }
  }
  function emitSmoke(x, y, n) {
    for (let i = 0; i < n; i++) {
      smoke.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 60,
        r: 8 + Math.random() * 14,
        life: 1.0 + Math.random() * 1.2, max: 2.4,
      });
    }
  }
  function emitDebris(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 120 + Math.random() * 380;
      debris.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120,
        w: 6 + Math.random() * 10, h: 4 + Math.random() * 6,
        angle: Math.random() * Math.PI, av: (Math.random() - 0.5) * 14,
        life: 2.5 + Math.random() * 2, max: 4.5,
        color: Math.random() < 0.5 ? "#2f6fd0" : "#1b3f8f",
      });
    }
  }

  /* --------------------- physics step ----------------------- */
  function stepBrick(b, dt) {
    b.vy += GRAVITY * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.angle += b.av * dt;

    // ground
    const bottom = b.y + b.h / 2;
    if (bottom > GROUND_Y) {
      b.y = GROUND_Y - b.h / 2;
      b.vy = -b.vy * 0.32;
      if (Math.abs(b.vy) < 40) b.vy = 0;
      // friction + induced spin
      b.vx *= 0.62;
      b.av += b.vx * 0.008 + (Math.random() - 0.5) * 2;
      b.av *= 0.9;
    }
    // side walls
    if (b.x - b.w / 2 < 0) { b.x = b.w / 2; b.vx = -b.vx * 0.4; }
    if (b.x + b.w / 2 > W) { b.x = W - b.w / 2; b.vx = -b.vx * 0.4; }
  }

  function resolveBrickPair(a, b, e, dt) {
    const c = satCollide(a, b);
    if (!c) return;
    const ra = corners(a), rb = corners(b);
    // find contact points closest to center along normal
    let dotA = -Infinity, dotB = Infinity;
    for (const p of ra) { const d = (p.x - a.x) * c.normal.x + (p.y - a.y) * c.normal.y; if (d > dotA) dotA = d; }
    for (const p of rb) { const d = (p.x - b.x) * c.normal.x + (p.y - b.y) * c.normal.y; if (d < dotB) dotB = d; }
    const contactX = (a.x * dotA + b.x * dotB) / 2;
    const contactY = (a.y * dotA + b.y * dotB) / 2;

    // separate
    a.x -= c.normal.x * c.depth / 2;
    a.y -= c.normal.y * c.depth / 2;
    b.x += c.normal.x * c.depth / 2;
    b.y += c.normal.y * c.depth / 2;

    // relative velocity
    const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
    const vn = rvx * c.normal.x + rvy * c.normal.y;
    if (vn > 0) return;
    const m = 1;
    const j = -(1 + e) * vn / (1 / m + 1 / m);
    a.vx -= (j * c.normal.x) / m; a.vy -= (j * c.normal.y) / m;
    b.vx += (j * c.normal.x) / m; b.vy += (j * c.normal.y) / m;

    // spin from tangential impulse
    const tvx = rvx - vn * c.normal.x, tvy = rvy - vn * c.normal.y;
    const half = b.w / 2;
    const ra1 = Math.atan2(contactY - b.y, contactX - b.x);
    const impulse = j * 0.35;
    b.av += (tvx * Math.cos(ra1) + tvy * Math.sin(ra1)) * 0.02;
    a.av -= (tvx * Math.cos(ra1) + tvy * Math.sin(ra1)) * 0.02;
    b.av *= 0.9; a.av *= 0.9;

    // spawn impact sparks occasionally
    if (Math.abs(vn) > 300 && Math.random() < 0.4) {
      emitSparks(contactX, contactY, 3);
    }
  }

  function triggerCrash() {
    if (crashed) return;
    crashed = true;
    emitSparks(car.x + car.w / 2, car.y, 40);
    emitSparks(car.x + car.w / 2, car.y, 40);
    // shove nearby bricks apart
    for (const b of bricks) {
      const dx = b.x - car.x, dy = b.y - car.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 90 * 90) {
        const d = Math.sqrt(d2) || 1;
        const push = 900 / d;
        b.vx += (dx / d) * push;
        b.vy += (dy / d) * push - 200;
        b.av += (Math.random() - 0.5) * 8;
      }
    }
    emitDebris(car.x + car.w / 2, car.y, 14);
    emitSmoke(car.x + car.w / 2, car.y, 6);
  }

  function update(dt) {
    // --- car driving ---
    if (!crashed) {
      car.x += car.vx * dt;
      if (car.x > W - 60) car.x = W - 60;
      if (car.x < 70) car.x = 70;
    } else {
      // keep plowing a little, then settle
      car.vx *= Math.pow(0.15, dt);
      car.x += car.vx * dt;
      car.crumple += dt * 34;
      if (car.crumple > 70) car.crumple = 70;
      if (car.crumple > 30 && car.headlight) {
        car.headlight = false;
        debris.push({ x: car.x + car.w / 2, y: car.y - 8, vx: 60 + Math.random() * 120, vy: -60, w: 10, h: 8, angle: 0, av: 0, life: 2.5, max: 2.5, color: "#ffe27a" });
      }
      if (car.crumple > 55 && Math.random() < 0.6) {
        car.w = Math.max(90, car.w - dt * 4);
      }
      if (car.crumple > 60 && Math.random() < 0.5) {
        emitSmoke(car.x + car.w / 2, car.y, 1);
      }
    }

    // --- bricks ---
    for (const b of bricks) stepBrick(b, dt);

    // brick vs brick (SAT)
    for (let i = 0; i < bricks.length; i++)
      for (let j = i + 1; j < bricks.length; j++)
        resolveBrickPair(bricks[i], bricks[j], 0.28, dt);

    // car vs bricks (SAT). Car front face box.
    if (car) {
      const front = {
        x: car.x + car.w / 2 - car.crumple, y: car.y,
        w: car.crumple, h: car.h, angle: 0,
      };
      for (const b of bricks) {
        const c = satCollide(front, b);
        if (c) { triggerCrash(); break; }
      }
    }

    // knocked counter: count flying bricks once
    for (const b of bricks) {
      if (!b.knocked && (Math.abs(b.vx) + Math.abs(b.vy)) > 150) {
        b.knocked = true; knocked++;
        counterEl.textContent = "Bricks knocked: " + knocked;
      }
    }

    // --- debris ---
    for (let i = debris.length - 1; i >= 0; i--) {
      const p = debris[i];
      p.vy += GRAVITY * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.angle += p.av * dt;
      p.av *= 0.98;
      // ground
      if (p.y + p.h / 2 > GROUND_Y) { p.y = GROUND_Y - p.h / 2; p.vy *= -0.3; p.vx *= 0.7; p.av *= 0.6; }
      if (--p.life <= 0) debris.splice(i, 1);
    }

    // --- sparks ---
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.vy += GRAVITY * 0.3 * dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0) sparks.splice(i, 1);
    }

    // --- smoke ---
    for (let i = smoke.length - 1; i >= 0; i--) {
      const s = smoke[i];
      s.vy += -20 * dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.r += dt * 22;
      s.life -= dt;
      if (s.life <= 0) smoke.splice(i, 1);
    }
  }

  /* --------------------- rendering -------------------------- */
  function drawBackground() {
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#3a2d5c");
    g.addColorStop(0.6, "#4a3a63");
    g.addColorStop(1, "#2b2640");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // road
    ctx.fillStyle = "#39322b";
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    // grass edge
    ctx.fillStyle = "#4c7a3a";
    ctx.fillRect(0, GROUND_Y - 8, W, 8);
    // road dashes
    ctx.fillStyle = "#f2e7a0";
    const dash = 40;
    for (let x = (last / dash | 0) * dash; x < W; x += dash * 2) {
      ctx.fillRect(x, GROUND_Y + 22, 24, 6);
    }
  }

  function drawBrick(b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.fillStyle = b.shade;
    ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
    // top highlight
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(-b.w / 2, -b.h / 2, b.w, 3);
    // bottom shadow
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(-b.w / 2, b.h / 2 - 3, b.w, 3);
    ctx.restore();
  }

  function drawCar() {
    if (!car) return;
    ctx.save();
    ctx.translate(car.x, car.y);

    const cr = car.crumple;
    const bodyW = car.w - cr;
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(0, car.h / 2 + 14, 60, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // body
    const dmg = cr / 70;
    const bodyColor = "#e2553b";
    ctx.fillStyle = bodyColor;
    roundRect(-bodyW / 2, -car.h / 2, bodyW, car.h, 8);
    ctx.fill();
    // crumple sheen (dark front)
    if (cr > 5) {
      ctx.fillStyle = "#8f2a1a";
      roundRect(bodyW / 2 - cr, -car.h / 2, cr, car.h, 6);
      ctx.fill();
      // broken panel bits
      ctx.fillStyle = "#6f1f12";
      for (let i = 0; i < 4; i++) {
        const bx = bodyW / 2 - cr + 4 + i * 6;
        ctx.fillRect(bx, -car.h / 2 + 6 + (i % 2) * 8, 4, 4);
      }
    }

    // cabin
    ctx.fillStyle = "#223052";
    roundRect(-bodyW / 2 + 6, -car.h / 2 - 16, bodyW - 24, 18, 5);
    ctx.fill();
    ctx.fillStyle = "rgba(150,200,255,0.5)";
    roundRect(-bodyW / 2 + 10, -car.h / 2 - 13, bodyW - 34, 12, 4);
    ctx.fill();

    // bumper
    ctx.fillStyle = "#333a44";
    roundRect(-bodyW / 2, car.h / 2 - 8, bodyW, 8, 4);
    ctx.fill();

    // headlight (only before heavy damage)
    if (car.headlight) {
      ctx.fillStyle = "#ffe27a";
      ctx.shadowColor = "#ffe27a"; ctx.shadowBlur = 10;
      ctx.fillRect(bodyW / 2 - 4, -car.h / 2 + 6, 6, 10);
      ctx.shadowBlur = 0;
    }

    // wheels
    ctx.fillStyle = "#111";
    for (const wx of [-bodyW / 2 + 16, bodyW / 2 - 16]) {
      ctx.beginPath();
      ctx.arc(wx, car.h / 2, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#555";
      ctx.beginPath();
      ctx.arc(wx, car.h / 2, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111";
    }

    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawParticle(p) {
    const a = p.life / p.max;
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    if (p.color === "rgba(0,0,0,0)") { ctx.fillStyle = p.color; ctx.fillRect(0, 0, W, H); return; }
    ctx.fillStyle = p.color;
    if (p.w != null) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size || p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    drawBackground();
    for (const b of bricks) drawBrick(b);
    // debris behind car
    for (const p of debris) drawParticle(p);
    drawCar();
    // sparks in front
    for (const s of sparks) {
      ctx.globalAlpha = s.life / s.max;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // smoke
    for (const s of smoke) {
      ctx.globalAlpha = (s.life / s.max) * 0.5;
      ctx.fillStyle = "#8a8a92";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* --------------------- main loop -------------------------- */
  function frame(t) {
    if (!last) last = t;
    let dt = (t - last) / 1000;
    last = t;
    if (dt > 0.033) dt = 0.033;
    if (running) {
      update(dt);
      draw();
    }
    requestAnimationFrame(frame);
  }

  /* --------------------- wiring ----------------------------- */
  replayBtn.addEventListener("click", function () {
    reset();
    last = 0;
  });

  reset();
  requestAnimationFrame(frame);
})();
