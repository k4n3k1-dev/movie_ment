import * as THREE from 'three';

export class PlayerController {
  constructor(camera, domElement, player, level = null) {
    this.camera = camera;
    this.dom = domElement;
    this.player = player;
    this.level = level;

    this.moveSpeed = 3.5;
    this.sprintMultiplier = 1.6;
    this.sprintUnlocked = true;
    this.jumpVelocity = 5;
    this.gravity = -14;
    this.collisionRadius = 0.35;
    this.standingHeight = 1.9;
    this.crawlHeight = 1.05;
    this.velocityY = 0;
    this.grounded = true;
    this.jumpCount = 0;
    this.maxJumps = 2;
    this.crawling = false;
    this.keys = new Set();
    this.yaw = 0;
    this.chaseHeight = 0.5;
    this.lookPitch = 0;
    this.distance = 5;
    this.cameraMode = 'chase';
    this.interactCallback = null;
    this._bind();
  }

  onInteract(fn) { this.interactCallback = fn; }

  _bind() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyE' && this.interactCallback) this.interactCallback();
      if (e.code === 'Digit1') this._setCameraMode('chase');
      if (e.code === 'Digit2') this._setCameraMode('first');
      if (e.code === 'Digit3') this._setCameraMode('top');
      if ((e.code === 'KeyC' || e.code === 'ControlLeft') && !e.repeat) this.crawling = !this.crawling;
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
    this.player.setVisible(mode !== 'first');
  }

  get moveState() {
    const moving = this.keys.has('KeyW') || this.keys.has('KeyS') || this.keys.has('KeyA') || this.keys.has('KeyD');
    const sprinting = this.sprintUnlocked && this.keys.has('ShiftLeft') && !this.crawling;
    return { moving, speed: sprinting ? this.sprintMultiplier : 1 };
  }

  _resolveCollisions(position) {
    if (!this.level) return;
    const r = this.collisionRadius;
    const playerHeight = this.crawling ? this.crawlHeight : this.standingHeight;
    for (const box of this.level.getColliders()) {
      // Overhead crawl obstacles are passable while crawling.
      if (box.min.y > 0.15 && box.min.y >= playerHeight - 0.05) continue;
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

  _tryJump() {
    if (this.crawling) return;
    if (this.grounded) {
      this.velocityY = this.jumpVelocity;
      this.grounded = false;
      this.jumpCount = 1;
    } else if (this.jumpCount < this.maxJumps) {
      this.velocityY = this.jumpVelocity;
      this.jumpCount++;
    }
  }

  update(delta) {
    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.sin(this.yaw + Math.PI / 2), 0, Math.cos(this.yaw + Math.PI / 2));
    const move = new THREE.Vector3();
    const reversed = this.cameraMode === 'first';
    if (this.keys.has('KeyW')) reversed ? move.sub(forward) : move.add(forward);
    if (this.keys.has('KeyS')) reversed ? move.add(forward) : move.sub(forward);
    if (this.keys.has('KeyA')) reversed ? move.sub(right) : move.add(right);
    if (this.keys.has('KeyD')) reversed ? move.add(right) : move.sub(right);

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

    // Space is edge-triggered so holding it doesn't consume both jumps immediately.
    if (this.keys.has('Space') && !this.spaceWasDown) this._tryJump();
    this.spaceWasDown = this.keys.has('Space');

    this.velocityY += this.gravity * delta;
    const previousY = playerObj.position.y;
    playerObj.position.y += this.velocityY * delta;
    const groundHeight = this.level?.getGroundHeight(playerObj.position, this.collisionRadius, previousY, this.velocityY, this.crawling) ?? 0;
    if (playerObj.position.y <= groundHeight) {
      playerObj.position.y = groundHeight;
      this.velocityY = 0;
      this.grounded = true;
      this.jumpCount = 0;
    } else {
      this.grounded = false;
    }

    // Prevent entering an overhead obstacle while standing; crawl lets the player pass.
    if (!this.crawling && this.level?.isBlockedByLowCeiling(playerObj.position, this.collisionRadius, this.standingHeight)) {
      playerObj.position.y = Math.max(playerObj.position.y, this.level.getGroundHeight(playerObj.position, this.collisionRadius, previousY, this.velocityY, false));
    }

    this.player.update(delta, { moving, speed: moving ? speed : 0, grounded: this.grounded, verticalVelocity: this.velocityY, crawling: this.crawling });
    this._updateCamera(playerObj);
  }

  _updateCamera(playerObj) {
    const eyeHeight = this.crawling ? 0.9 : 1.6;
    if (this.cameraMode === 'first') {
      this.camera.position.copy(playerObj.position).add(new THREE.Vector3(0, eyeHeight, 0));
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.set(this.lookPitch, this.yaw, 0);
      return;
    }
    if (this.cameraMode === 'top') {
      this.camera.position.set(0, 55, 22);
      this.camera.lookAt(0, 0, 0);
      return;
    }
    const camOffset = new THREE.Vector3(Math.sin(this.yaw) * -this.distance, this.distance * this.chaseHeight, Math.cos(this.yaw) * -this.distance);
    this.camera.position.copy(playerObj.position).add(camOffset);
    this.camera.lookAt(playerObj.position.clone().add(new THREE.Vector3(0, this.crawling ? 0.7 : 1, 0)));
  }
}
