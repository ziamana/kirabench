// === Simple 2D Physics Engine ===

const GRAVITY = 980; // pixels/s²
const DAMPING = 0.98; // air resistance
const BOUNCE_DAMPING = 0.5; // energy lost on bounce
const FRICTION = 0.7; // ground friction

class Vec2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  add(v) { return new Vec2(this.x + v.x, this.y + v.y); }
  sub(v) { return new Vec2(this.x - v.x, this.y - v.y); }
  mul(s) { return new Vec2(this.x * s, this.y * s); }
  len() { return Math.sqrt(this.x * this.x + this.y * this.y); }
  norm() { const l = this.len(); return l > 0 ? this.mul(1/l) : new Vec2(); }
  dot(v) { return this.x * v.x + this.y * v.y; }
  rotate(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return new Vec2(this.x * c - this.y * s, this.x * s + this.y * c);
  }
}

class PhysicsBody {
  constructor(x, y, w, h, mass = 1, restitution = 0.3) {
    this.pos = new Vec2(x, y);
    this.vel = new Vec2(0, 0);
    this.w = w;
    this.h = h;
    this.mass = mass;
    this.invMass = mass > 0 ? 1/mass : 0;
    this.restitution = restitution;
    this.angle = 0;
    this.angularVel = 0;
    this.kinetic = true;
    this.active = true;
    this.color = '#888';
    this.brickColor = null;
    this.knocked = false;
  }

  get corners() {
    const cos = Math.cos(this.angle), sin = Math.sin(this.angle);
    const hw = this.w/2, hh = this.h/2;
    const offsets = [
      new Vec2(-hw, -hh), new Vec2(hw, -hh),
      new Vec2(hw, hh), new Vec2(-hw, hh)
    ];
    return offsets.map(o => o.rotate(this.angle).add(this.pos));
  }

  update(dt) {
    if (!this.active || !this.kinetic) return;
    this.vel.y += GRAVITY * dt;
    this.vel = this.vel.mul(DAMPING);
    this.pos = this.pos.add(this.vel.mul(dt));
    this.angle += this.angularVel * dt;
    this.angularVel *= 0.995;
  }

  resolveGround(groundY) {
    const bottom = this.pos.y + this.h/2 * Math.cos(this.angle) + this.w/2 * Math.abs(Math.sin(this.angle));
    if (bottom > groundY) {
      const depth = bottom - groundY;
      this.pos.y -= depth;
      if (this.vel.y > 0) {
        this.vel.y *= -BOUNCE_DAMPING;
        this.vel.x *= FRICTION;
        this.angularVel *= 0.8;
        if (Math.abs(this.vel.y) < 10) {
          this.vel.y = 0;
        }
      }
    }
  }

  resolveWall(wallX) {
    const right = this.pos.x + this.w/2;
    if (right > wallX) {
      this.pos.x = wallX - this.w/2;
      if (this.vel.x > 0) {
        this.vel.x *= -BOUNCE_DAMPING;
      }
    }
    const left = this.pos.x - this.w/2;
    if (left < wallX) {
      this.pos.x = wallX + this.w/2;
      if (this.vel.x < 0) {
        this.vel.x *= -BOUNCE_DAMPING;
      }
    }
  }

  get boundingBox() {
    const corners = this.corners;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const c of corners) {
      if (c.x < minX) minX = c.x;
      if (c.x > maxX) maxX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.y > maxY) maxY = c.y;
    }
    return { minX, maxX, minY, maxY };
  }

  overlaps(other) {
    const a = this.boundingBox;
    const b = other.boundingBox;
    return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
  }
}

function resolveCollision(a, b, groundY) {
  if (!a.active || !b.active) return;
  if (!a.overlaps(b)) return;

  const ab = b.pos.sub(a.pos);
  const dx = Math.abs(ab.x);
  const dy = Math.abs(ab.y);
  const overlapX = (a.w/2 + b.w/2) * 0.85 - dx;
  const overlapY = (a.h/2 + b.h/2) * 0.85 - dy;

  if (overlapX > 0 && overlapY > 0) {
    let normal, depth;
    if (overlapX < overlapY) {
      normal = new Vec2(ab.x > 0 ? 1 : -1, 0);
      depth = overlapX;
    } else {
      normal = new Vec2(0, ab.y > 0 ? 1 : -1);
      depth = overlapY;
    }

    const totalInvMass = a.invMass + b.invMass;
    if (totalInvMass === 0) return;

    // Separate
    const sep = normal.mul(depth / totalInvMass);
    a.pos = a.pos.sub(sep.mul(a.invMass));
    b.pos = b.pos.add(sep.mul(b.invMass));

    // Relative velocity
    const relVel = b.vel.sub(a.vel);
    const velAlongNormal = relVel.dot(normal);
    if (velAlongNormal > 0) return; // moving apart

    const e = Math.min(a.restitution, b.restitution);
    const j = -(1 + e) * velAlongNormal / totalInvMass;
    const impulse = normal.mul(j);

    a.vel = a.vel.sub(impulse.mul(a.invMass));
    b.vel = b.vel.add(impulse.mul(b.invMass));

    // Angular velocity from off-center hit
    const crossX = (a.pos.x - b.pos.x);
    const crossY = (a.pos.y - b.pos.y);
    a.angularVel += (crossX * impulse.y - crossY * impulse.x) * 0.001;
    b.angularVel -= (crossX * impulse.y - crossY * impulse.x) * 0.001;

    // Mark as knocked
    if (b.kinetic) b.knocked = true;
    if (a.kinetic) a.knocked = true;
  }
}
