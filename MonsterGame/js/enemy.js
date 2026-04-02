import { FiniteStateMachine } from './fsm.js';

const randRange = (min, max) => min + Math.random() * (max - min);

export class Enemy {
  constructor(x, y, id) {
    this.id = id;
    this.spawnX = x;
    this.spawnY = y;
    this.x = x;
    this.y = y;
    this.radius = 0.24;
    this.speed = randRange(0.85, 1.18);
    this.health = 100;
    this.maxHealth = 100;
    this.attackCooldown = 0;
    this.attackRange = 1.55;
    this.stateTime = 0;
    this.visible = true;
    this.respawnDelay = randRange(3.5, 5.5);
    this.direction = randRange(0, Math.PI * 2);
    this.fsm = this.createFSM();
  }

  createFSM() {
    const fsm = new FiniteStateMachine(this, 'IDLE');

    fsm
      .addState('IDLE', {
        onEnter: (enemy) => { enemy.stateTime = 0; },
        onUpdate: (enemy, context) => {
          enemy.stateTime += context.dt;
          enemy.attackCooldown = Math.max(0, enemy.attackCooldown - context.dt);
        },
        transitions: [
          { target: 'DEAD', condition: (enemy) => enemy.health <= 0 },
          { target: 'PATROL', condition: (enemy) => enemy.stateTime > 1.2 },
          { target: 'CHASE', condition: (enemy, context) => enemy.canSeePlayer(context) && enemy.distanceToPlayer(context.player) < 7.5 },
        ],
      })
      .addState('PATROL', {
        onEnter: (enemy) => {
          enemy.stateTime = 0;
          enemy.direction = randRange(0, Math.PI * 2);
        },
        onUpdate: (enemy, context) => {
          enemy.stateTime += context.dt;
          enemy.attackCooldown = Math.max(0, enemy.attackCooldown - context.dt);
          enemy.wander(context.dt, context.map);
          if (enemy.stateTime > 2.3) {
            enemy.direction += randRange(-1.2, 1.2);
            enemy.stateTime = 0.5;
          }
        },
        transitions: [
          { target: 'DEAD', condition: (enemy) => enemy.health <= 0 },
          { target: 'CHASE', condition: (enemy, context) => enemy.canSeePlayer(context) && enemy.distanceToPlayer(context.player) < 8.2 },
        ],
      })
      .addState('CHASE', {
        onEnter: (enemy) => { enemy.stateTime = 0; },
        onUpdate: (enemy, context) => {
          enemy.stateTime += context.dt;
          enemy.attackCooldown = Math.max(0, enemy.attackCooldown - context.dt);
          enemy.moveTowards(context.player.x, context.player.y, context.dt, context.map, 1.15);
        },
        transitions: [
          { target: 'DEAD', condition: (enemy) => enemy.health <= 0 },
          { target: 'FLEE', condition: (enemy) => enemy.health < enemy.maxHealth * 0.25 },
          { target: 'ATTACK', condition: (enemy, context) => enemy.distanceToPlayer(context.player) < enemy.attackRange },
          { target: 'PATROL', condition: (enemy, context) => !enemy.canSeePlayer(context) && enemy.distanceToPlayer(context.player) > 9.5 },
        ],
      })
      .addState('ATTACK', {
        onEnter: (enemy) => { enemy.stateTime = 0; },
        onUpdate: (enemy, context) => {
          enemy.stateTime += context.dt;
          enemy.attackCooldown = Math.max(0, enemy.attackCooldown - context.dt);
          enemy.facePlayer(context.player);
          if (enemy.attackCooldown <= 0 && enemy.distanceToPlayer(context.player) < enemy.attackRange + 0.25) {
            context.player.takeDamage(randRange(7, 12));
            context.sound('hurt');
            enemy.attackCooldown = 0.95;
          }
        },
        transitions: [
          { target: 'DEAD', condition: (enemy) => enemy.health <= 0 },
          { target: 'FLEE', condition: (enemy) => enemy.health < enemy.maxHealth * 0.25 },
          { target: 'CHASE', condition: (enemy, context) => enemy.distanceToPlayer(context.player) > enemy.attackRange + 0.6 },
        ],
      })
      .addState('FLEE', {
        onEnter: (enemy) => { enemy.stateTime = 0; },
        onUpdate: (enemy, context) => {
          enemy.stateTime += context.dt;
          enemy.attackCooldown = Math.max(0, enemy.attackCooldown - context.dt);
          const dx = enemy.x - context.player.x;
          const dy = enemy.y - context.player.y;
          enemy.moveTowards(enemy.x + dx, enemy.y + dy, context.dt, context.map, 1.3);
        },
        transitions: [
          { target: 'DEAD', condition: (enemy) => enemy.health <= 0 },
          { target: 'PATROL', condition: (enemy, context) => enemy.distanceToPlayer(context.player) > 5.2 },
          { target: 'ATTACK', condition: (enemy, context) => enemy.distanceToPlayer(context.player) < 1.1 && enemy.health > enemy.maxHealth * 0.18 },
        ],
      })
      .addState('DEAD', {
        onEnter: (enemy) => {
          enemy.stateTime = 0;
          enemy.visible = false;
        },
        onUpdate: (enemy, context) => {
          enemy.stateTime += context.dt;
        },
        transitions: [
          { target: 'RESPAWN', condition: (enemy) => enemy.stateTime > enemy.respawnDelay },
        ],
      })
      .addState('RESPAWN', {
        onEnter: (enemy) => {
          enemy.stateTime = 0;
          enemy.health = enemy.maxHealth;
          enemy.x = enemy.spawnX;
          enemy.y = enemy.spawnY;
          enemy.visible = true;
          enemy.direction = randRange(0, Math.PI * 2);
        },
        onUpdate: (enemy, context) => {
          enemy.stateTime += context.dt;
        },
        transitions: [
          { target: 'IDLE', condition: (enemy) => enemy.stateTime > 0.4 },
        ],
      });

    return fsm;
  }

  update(context) {
    this.fsm.update(context);
  }

  distanceToPlayer(player) {
    return Math.hypot(player.x - this.x, player.y - this.y);
  }

  facePlayer(player) {
    this.direction = Math.atan2(player.y - this.y, player.x - this.x);
  }

  wander(dt, map) {
    const nextX = this.x + Math.cos(this.direction) * this.speed * 0.45 * dt;
    const nextY = this.y + Math.sin(this.direction) * this.speed * 0.45 * dt;
    if (!this.isBlocked(nextX, nextY, map)) {
      this.x = nextX;
      this.y = nextY;
    } else {
      this.direction += randRange(-1.5, 1.5);
    }
  }

  moveTowards(targetX, targetY, dt, map, multiplier = 1) {
    const angle = Math.atan2(targetY - this.y, targetX - this.x);
    this.direction = angle;
    const nextX = this.x + Math.cos(angle) * this.speed * multiplier * dt;
    const nextY = this.y + Math.sin(angle) * this.speed * multiplier * dt;
    if (!this.isBlocked(nextX, nextY, map)) {
      this.x = nextX;
      this.y = nextY;
      return;
    }

    const sidestepX = this.x + Math.cos(angle + Math.PI / 2) * this.speed * 0.7 * dt;
    const sidestepY = this.y + Math.sin(angle + Math.PI / 2) * this.speed * 0.7 * dt;
    if (!this.isBlocked(sidestepX, sidestepY, map)) {
      this.x = sidestepX;
      this.y = sidestepY;
    }
  }

  isBlocked(x, y, map) {
    return map[Math.floor(y)]?.[Math.floor(x)] > 0;
  }

  canSeePlayer(context) {
    const player = context.player;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(3, Math.floor(distance * 8));

    for (let i = 1; i <= steps; i += 1) {
      const checkX = this.x + (dx * i) / steps;
      const checkY = this.y + (dy * i) / steps;
      if (context.map[Math.floor(checkY)]?.[Math.floor(checkX)] > 0) {
        return false;
      }
    }

    return true;
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }

  get state() {
    return this.fsm.currentState;
  }
}
