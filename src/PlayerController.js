import * as THREE from 'three';

/**
 * Drives the Player from keyboard/mouse input and positions an elevated
 * third-person chase camera. Movement is camera-relative: W always moves
 * "away from the camera," matching what the player sees.
 *
 * Click the canvas to lock the pointer and enable mouse-look (required by
 * browsers before they'll report raw mouse movement).
 *
 * Pass a `level` object exposing getColliders(): THREE.Box3[] to get wall
 * collision for free — works with TestLevel now and Sino's real museum later
 * as long as it exposes the same method.
 */
export class PlayerController {
  constructor(camera, domElement, player, level = null) {
    this.camera = camera;
    this.dom = domElement;
    this.player = player;
    this.level = level;

    this.moveSpeed = 3.5;        // units/sec
    this.sprintMultiplier = 1.6;  // Shift ability
    this.sprintUnlocked = true;   // set false until Level 1's 5/5 reward is earned
    this.jumpVelocity = 5;
    this.gravity = -14;
    this.collisionRadius = 0.35;  // treat the player as a circle of this radius for wall collision

    this.velocityY = 0;
    this.grounded = true;

    this.keys = new Set();
    this.yaw = 0;      // camera orbit angle around the player
    this.pitch = 0.5;  // 0 (low) .. ~1.3 (high, near top-down)
    this.distance = 5;

    this.interactCallback = null; // set via onInteract(fn)

    this._bind();
  }

  /** Register a callback for the E key — Tumi's steal logic and door-opening both hook in here. */
  onInteract(fn) {
    this.interactCallback = fn;
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyE' && this.interactCallback) this.interactCallback();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    this.dom.addEventListener('click', () => this.dom.requestPointerLock());
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.dom) return;
      this.yaw -= e.movementX * 0.0025;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.0025, 0.15, 1.3);
    });
  }

  get moveState() {
    const moving = this.keys.has('KeyW') || this.keys.has('KeyS') ||
      this.keys.has('KeyA') || this.keys.has('KeyD');
    const sprinting = this.sprintUnlocked && this.keys.has('ShiftLeft');
    return { moving, speed: sprinting ? this.sprintMultiplier : 1 };
  }

  /** Push the player out of any overlapping wall/door box (circle-vs-AABB, resolved per box). */
  _resolveCollisions(position) {
    if (!this.level) return;
    const r = this.collisionRadius;
    for (const box of this.level.getColliders()) {
      const closestX = THREE.MathUtils.clamp(position.x, box.min.x, box.max.x);
      const closestZ = THREE.MathUtils.clamp(position.z, box.min.z, box.max.z);
      const dx = position.x - closestX;
      const dz = position.z - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < r * r) {
        const dist = Math.sqrt(distSq) || 0.0001;
        const overlap = r - dist;
        position.x += (dx / dist) * overlap;
        position.z += (dz / dist) * overlap;
      }
    }
  }

  update(delta) {
    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.sin(this.yaw + Math.PI / 2), 0, Math.cos(this.yaw + Math.PI / 2));

    const move = new THREE.Vector3();
    if (this.keys.has('KeyW')) move.add(forward);
    if (this.keys.has('KeyS')) move.sub(forward);
    if (this.keys.has('KeyD')) move.add(right);
    if (this.keys.has('KeyA')) move.sub(right);

    const { moving, speed } = this.moveState;
    const playerObj = this.player.object3D;

    if (moving) {
      move.normalize().multiplyScalar(this.moveSpeed * speed * delta);
      playerObj.position.add(move);
      this._resolveCollisions(playerObj.position);

      // rotate the root to face the movement direction, shortest-path damped
      const targetAngle = Math.atan2(move.x, move.z);
      let diff = targetAngle - playerObj.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // wrap to [-PI, PI]
      playerObj.rotation.y += diff * Math.min(1, 10 * delta);
    }

    // Jump / gravity against a flat y=0 floor. Swap for Sino's real ground
    // check later if levels ever need multi-height floors; everything else
    // (root position, camera) stays the same.
    if (this.keys.has('Space') && this.grounded) {
      this.velocityY = this.jumpVelocity;
      this.grounded = false;
    }
    this.velocityY += this.gravity * delta;
    playerObj.position.y += this.velocityY * delta;
    if (playerObj.position.y <= 0) {
      playerObj.position.y = 0;
      this.velocityY = 0;
      this.grounded = true;
    }

    this.player.update(delta, { moving, speed: moving ? speed : 0 });

    // Elevated chase camera, orbiting with the mouse around the player.
    const camOffset = new THREE.Vector3(
      Math.sin(this.yaw) * -this.distance,
      this.distance * this.pitch,
      Math.cos(this.yaw) * -this.distance
    );
    this.camera.position.copy(playerObj.position).add(camOffset);
    this.camera.lookAt(playerObj.position.clone().add(new THREE.Vector3(0, 1, 0)));
  }
}
