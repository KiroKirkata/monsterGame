export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = 0;
    this.radius = 0.22;
    this.health = 100;
    this.maxHealth = 100;
    this.score = 0;
    this.wave = 1;
    this.moveSpeed = 2.8;
    this.sprintMultiplier = 1.45;
    this.turnSensitivity = 0.0027;
    this.ammo = 12;
    this.maxAmmo = 12;
    this.reloadTimer = 0;
    this.reloadDuration = 1.25;
    this.shootCooldown = 0;
    this.damageFlash = 0;
  }

  update(dt, input, map) {
    this.reloadTimer = Math.max(0, this.reloadTimer - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.damageFlash = Math.max(0, this.damageFlash - dt);

    const sprinting = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
    const speed = this.moveSpeed * (sprinting ? this.sprintMultiplier : 1) * dt;
    const forward = (input.keys.has('KeyW') ? 1 : 0) - (input.keys.has('KeyS') ? 1 : 0);
    const strafe = (input.keys.has('KeyD') ? 1 : 0) - (input.keys.has('KeyA') ? 1 : 0);

    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);

    let moveX = cos * forward * speed + Math.cos(this.angle + Math.PI / 2) * strafe * speed;
    let moveY = sin * forward * speed + Math.sin(this.angle + Math.PI / 2) * strafe * speed;

    this.tryMove(moveX, moveY, map);
  }

  tryMove(dx, dy, map) {
    const nextX = this.x + dx;
    const nextY = this.y + dy;

    if (!this.isBlocked(nextX, this.y, map)) {
      this.x = nextX;
    }

    if (!this.isBlocked(this.x, nextY, map)) {
      this.y = nextY;
    }
  }

  isBlocked(x, y, map) {
    const samples = [
      [x - this.radius, y - this.radius],
      [x + this.radius, y - this.radius],
      [x - this.radius, y + this.radius],
      [x + this.radius, y + this.radius],
    ];

    return samples.some(([sampleX, sampleY]) => map[Math.floor(sampleY)]?.[Math.floor(sampleX)] > 0);
  }

  applyMouseMovement(deltaX) {
    this.angle += deltaX * this.turnSensitivity;
  }

  canShoot() {
    return this.reloadTimer <= 0 && this.shootCooldown <= 0 && this.ammo > 0;
  }

  shoot() {
    this.shootCooldown = 0.18;
    this.ammo = Math.max(0, this.ammo - 1);
  }

  reload() {
    if (this.reloadTimer <= 0 && this.ammo < this.maxAmmo) {
      this.reloadTimer = this.reloadDuration;
      return true;
    }
    return false;
  }

  finishReload() {
    if (this.reloadTimer <= 0) {
      this.ammo = this.maxAmmo;
    }
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    this.damageFlash = 0.2;
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.angle = 0;
    this.health = this.maxHealth;
    this.score = 0;
    this.wave = 1;
    this.ammo = this.maxAmmo;
    this.reloadTimer = 0;
    this.shootCooldown = 0;
    this.damageFlash = 0;
  }
}
