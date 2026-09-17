import * as THREE from 'three';

/**
 * Drives the Player from keyboard/mouse input and manages three camera modes.
 *
 * Camera modes (switch with 1 / 2 / 3):
 *   1 - chase   : elevated third-person, mouse-orbit around the player (default)
 *   2 - first   : eye-level first-person, mouse controls look direction directly
 *   3 - top     : fixed high overview of the whole floor (doesn't follow the player)
 *
 * Movement is always camera-yaw-relative: W moves "forward" from wherever you're facing.
 *
 * Click the canvas to lock the pointer and enable mouse-look.
 */
export class PlayerController {
  constructor(camera, domElement, player, level = null) {
    this.camera = camera;
    this.dom = domElement;
    this.player = player;
    this.level = level;

    this.moveSpeed = 3.5;
    this.sprintMultiplier = 1.6;
    this.sprintUnlocked = true; // sprint enabled for testing; gate this later behind Level 1's reward
    this.jumpVelocity = 5;
    this.gravity = -14;
    this.collisionRadius = 0.35;

    this.velocityY = 0;
    this.grounded = true;

    this.keys = new Set();
    this.yaw = 0;          // shared facing angle: drives movement AND chase/first-person camera
    this.chaseHeight = 0.5; // 0.15 (low) .. 1.3 (high) — chase camera height factor, mouse-controlled
    this.lookPitch = 0;     // first-person up/down look angle, mouse-controlled
    this.distance = 5;      // chase camera distance behind the player

    this.cameraMode = 'chase'; // 'chase' | 'first' | 'top'

    this.interactCallback = null;

    this._bind();
  }

  onInteract(fn) {
    this.interactCallback = fn;
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyE' && this.interactCallback) this.interactCallback();
      if (e.code === 'Digit1') this._setCameraMode('chase');
      if (e.code === 'Digit2') this._setCameraMode('first');
      if (e.code === 'Digit3') this._setCameraMode('top');
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    this.dom.addEventListener('click', () => this.dom.requestPointerLock());
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.dom) return;
      this.yaw -= e.movementX * 0.0025;
      this.chaseHeight = THREE.MathUtils.clamp(this.chaseHeight - e.movementY * 0.0025, 0.15, 1.3);
      this.lookPitch = THREE.MathUtils.clamp(this.lookPitch - e.movementY * 0.0022, -1.2, 1.2);
    });
  }

  _setCameraMode(mode) {
    this.cameraMode = mode;
    // hide the avatar body in first-person so it doesn't clip the view
    this.player.setVisible(mode !== 'first');
  }

  get moveState() {
    const moving = this.keys.has('KeyW') || this.keys.has('KeyS') ||
      this.keys.has('KeyA') || this.keys.has('KeyD');
    const sprinting = this.sprintUnlocked && this.keys.has('ShiftLeft');
    return { moving, speed: sprinting ? this.sprintMultiplier : 1 };
  }

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
    if (this.keys.has('KeyA')) move.add(right);
    if (this.keys.has('KeyD')) move.sub(right);

    const { moving, speed } = this.moveState;
    const playerObj = this.player.object3D;

    if (moving) {
      move.normalize().multiplyScalar(this.moveSpeed * speed * delta);
      playerObj.position.add(move);
      this._resolveCollisions(playerObj.position);

      const targetAngle = Math.atan2(move.x, move.z);
      let diff = targetAngle - playerObj.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      playerObj.rotation.y += diff * Math.min(1, 10 * delta);
    }

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

    this._updateCamera(playerObj);
  }

  _updateCamera(playerObj) {
    if (this.cameraMode === 'first') {
      this.camera.position.copy(playerObj.position).add(new THREE.Vector3(0, 1.6, 0));
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.set(this.lookPitch, this.yaw, 0);
      return;
    }

    if (this.cameraMode === 'top') {
      // Fixed overview of the whole floor — doesn't track the player.
      this.camera.position.set(0, 55, 22);
      this.camera.lookAt(0, 0, 0);
      return;
    }

    // 'chase' (default): elevated third-person, orbiting on mouse look.
    const camOffset = new THREE.Vector3(
      Math.sin(this.yaw) * -this.distance,
      this.distance * this.chaseHeight,
      Math.cos(this.yaw) * -this.distance
    );
    this.camera.position.copy(playerObj.position).add(camOffset);
    this.camera.lookAt(playerObj.position.clone().add(new THREE.Vector3(0, 1, 0)));
  }
}
