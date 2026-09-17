import * as THREE from 'three';

const WALL_H = 3;
const WALL_T = 0.3;
const DOOR_W = 3.75;
const ROOM_W = 15;
const ROOM_Z_MIN = -10;
const ROOM_Z_MAX = 10;
const OUTER_X_MIN = -1.5 * ROOM_W;
const OUTER_X_MAX = 1.5 * ROOM_W;
const INTERACT_RANGE = 2.2;

export class TestLevel {
  constructor(scene) {
    this.scene = scene;
    this.wallColliders = [];
    this.doors = [];
    this.crates = [];
    this.crawlObstacles = [];
    this.rooms = [];

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.85 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.7 });
    const floorMat = this._makeWoodFloorMaterial();

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(OUTER_X_MAX - OUTER_X_MIN, ROOM_Z_MAX - ROOM_Z_MIN), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    this._wall(wallMat, OUTER_X_MIN, OUTER_X_MAX, ROOM_Z_MIN, ROOM_Z_MIN + WALL_T);
    this._wall(wallMat, OUTER_X_MIN, OUTER_X_MAX, ROOM_Z_MAX - WALL_T, ROOM_Z_MAX);
    this._wall(wallMat, OUTER_X_MIN, OUTER_X_MIN + WALL_T, ROOM_Z_MIN, ROOM_Z_MAX);
    this._wall(wallMat, OUTER_X_MAX - WALL_T, OUTER_X_MAX, ROOM_Z_MIN, ROOM_Z_MAX);

    const divider1X = OUTER_X_MIN + ROOM_W;
    const divider2X = OUTER_X_MIN + ROOM_W * 2;
    this._dividerWithDoor(wallMat, doorMat, divider1X);
    this._dividerWithDoor(wallMat, doorMat, divider2X);

    // Room 2 and 3 climbing routes: each route has 1, 2 and 3-box stacks.
    // The stacks are deliberately close enough to chain normal + double jumps.
    this._addClimbingRoute(2, divider1X + 2.0, -3.8);
    this._addClimbingRoute(3, divider2X + 2.0, 3.4);

    // Low cover/duct obstacles in rooms 2 and 3. C = toggle crawl to pass underneath.
    this._addCrawlTunnel(2, divider1X + 4.7, 2.2, 1.18, 3.2);
    this._addCrawlTunnel(3, divider2X + 4.7, -2.2, 1.18, 3.2);

    const roomBounds = [
      [OUTER_X_MIN, divider1X],
      [divider1X, divider2X],
      [divider2X, OUTER_X_MAX],
    ];
    for (const [xMin, xMax] of roomBounds) {
      const light = new THREE.PointLight(0xffe8c2, 1.15, 30);
      light.position.set((xMin + xMax) / 2, 2.6, 0);
      light.castShadow = true;
      scene.add(light);
      this.rooms.push({ xMin, xMax, light, baseIntensity: 0.9, litIntensity: 1.15 });
    }
  }

  _makeWoodFloorMaterial() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#9b6a3e';
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 64) {
      ctx.fillStyle = y % 128 === 0 ? '#a87546' : '#8d5d37';
      ctx.fillRect(0, y, 512, 62);
      ctx.strokeStyle = 'rgba(55,32,17,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y + 62);
      ctx.lineTo(512, y + 62);
      ctx.stroke();
      for (let x = 20 + ((y / 64) % 2) * 40; x < 512; x += 105) {
        ctx.strokeStyle = 'rgba(60,34,17,0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y + 8);
        ctx.quadraticCurveTo(x + 18, y + 30, x - 4, y + 54);
        ctx.stroke();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 4);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.78, metalness: 0.02 });
  }

  _wall(mat, x0, x1, z0, z1) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, WALL_H, z1 - z0), mat);
    mesh.position.set((x0 + x1) / 2, WALL_H / 2, (z0 + z1) / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    const box = new THREE.Box3(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, WALL_H, z1));
    this.wallColliders.push(box);
    return box;
  }

  _dividerWithDoor(wallMat, doorMat, x) {
    const gapHalf = DOOR_W / 2;
    this._wall(wallMat, x - WALL_T / 2, x + WALL_T / 2, ROOM_Z_MIN, -gapHalf);
    this._wall(wallMat, x - WALL_T / 2, x + WALL_T / 2, gapHalf, ROOM_Z_MAX);

    const pivot = new THREE.Group();
    pivot.position.set(x, 0, -gapHalf);
    this.scene.add(pivot);
    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(WALL_T, WALL_H, DOOR_W), doorMat);
    doorMesh.position.set(0, WALL_H / 2, gapHalf);
    doorMesh.castShadow = true;
    doorMesh.receiveShadow = true;
    pivot.add(doorMesh);

    const door = {
      pivot,
      collider: new THREE.Box3(new THREE.Vector3(x - WALL_T / 2, 0, -gapHalf), new THREE.Vector3(x + WALL_T / 2, WALL_H, gapHalf)),
      isOpen: false,
      currentAngle: 0,
      targetAngle: 0,
      openAngle: (Math.PI / 2) * 0.85,
    };
    this.doors.push(door);
    this.wallColliders.push(door.collider);
  }

  _crateMaterial() {
    return new THREE.MeshStandardMaterial({ color: 0x9a673b, roughness: 0.84 });
  }

  _addCrate(x, y, z, size = 1.0) {
    const mat = this._crateMaterial();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
    mesh.position.set(x, y + size / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    // Simple plank bands on the front/top faces for a readable crate.
    const bandMat = new THREE.MeshStandardMaterial({ color: 0x5c3921, roughness: 0.8 });
    for (const offset of [-size * 0.28, size * 0.28]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(size * 0.07, size * 1.01, size * 1.02), bandMat);
      band.position.set(x + offset, y + size / 2, z);
      band.castShadow = true;
      this.scene.add(band);
    }

    const box = new THREE.Box3(
      new THREE.Vector3(x - size / 2, y, z - size / 2),
      new THREE.Vector3(x + size / 2, y + size, z + size / 2)
    );
    // Mark this collider so PlayerController can treat it as a climbable
    // platform: land on the top instead of getting stuck against its side.
    box.userData = { isClimbable: true };
    this.crates.push({ mesh, box });
    return box;
  }

  _addClimbingRoute(roomNumber, startX, z) {
    const offsets = [0, 1.35, 2.7];
    const heights = [1, 2, 3];
    for (let i = 0; i < heights.length; i++) {
      for (let level = 0; level < heights[i]; level++) {
        this._addCrate(startX + offsets[i], 1.0 * level, z, 1.0);
      }
    }
  }

  _addCrawlTunnel(roomNumber, x, z, bottomY, width) {
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x56514b, roughness: 0.9 });
    const roofDepth = 3.2;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(width, 0.18, roofDepth), roofMat);
    roof.position.set(x, bottomY + 0.09, z);
    roof.castShadow = true;
    roof.receiveShadow = true;
    this.scene.add(roof);

    // Side posts leave a tunnel roughly 1.18m high, too low to stand but high enough to crawl.
    const postH = bottomY;
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, postH, roofDepth), roofMat);
      post.position.set(x + side * (width / 2 - 0.11), postH / 2, z);
      post.castShadow = true;
      post.receiveShadow = true;
      this.scene.add(post);
      this.wallColliders.push(new THREE.Box3(
        new THREE.Vector3(post.position.x - 0.11, 0, z - roofDepth / 2),
        new THREE.Vector3(post.position.x + 0.11, postH, z + roofDepth / 2)
      ));
    }

    const roofBox = new THREE.Box3(
      new THREE.Vector3(x - width / 2, bottomY, z - roofDepth / 2),
      new THREE.Vector3(x + width / 2, bottomY + 0.18, z + roofDepth / 2)
    );
    this.crawlObstacles.push(roofBox);
  }

  getColliders() {
    const doorBoxes = new Set(this.doors.map((d) => d.collider));
    return [...this.wallColliders, ...this.crates.map((c) => c.box), ...this.crawlObstacles]
      .filter((box) => !doorBoxes.has(box) || !this.doors.find((d) => d.collider === box)?.isOpen);
  }

  getGroundHeight(position, radius, previousY = position.y, velocityY = 0, crawling = false) {
    let ground = 0;
    if (velocityY <= 0) {
      for (const { box } of this.crates) {
        const overlapX = position.x + radius > box.min.x && position.x - radius < box.max.x;
        const overlapZ = position.z + radius > box.min.z && position.z - radius < box.max.z;
        if (!overlapX || !overlapZ) continue;

        // A crate top is a platform. Detect a downward crossing of its top,
        // then keep it as the current ground while the player remains over it.
        const crossedTop = previousY >= box.max.y - 0.08 && position.y <= box.max.y + 0.08;
        const alreadyStanding = Math.abs(previousY - box.max.y) <= 0.08 && position.y <= box.max.y + 0.08;
        if (crossedTop || alreadyStanding) ground = Math.max(ground, box.max.y);
      }
    }
    return ground;
  }

  isBlockedByLowCeiling(position, radius, playerHeight) {
    for (const box of this.crawlObstacles) {
      const overlapX = position.x + radius > box.min.x && position.x - radius < box.max.x;
      const overlapZ = position.z + radius > box.min.z && position.z - radius < box.max.z;
      if (overlapX && overlapZ && box.min.y < playerHeight && box.max.y > 0.5) return true;
    }
    return false;
  }

  _nearestDoor(playerPos, range) {
    let nearest = null;
    let nearestDist = Infinity;
    for (const door of this.doors) {
      const dist = playerPos.distanceTo(door.pivot.position);
      if (dist < range && dist < nearestDist) {
        nearest = door;
        nearestDist = dist;
      }
    }
    return nearest;
  }

  hasNearbyDoor(playerPos) { return !!this._nearestDoor(playerPos, INTERACT_RANGE); }

  tryInteract(playerPos) {
    const nearest = this._nearestDoor(playerPos, INTERACT_RANGE);
    if (nearest) {
      nearest.isOpen = !nearest.isOpen;
      nearest.targetAngle = nearest.isOpen ? nearest.openAngle : 0;
    }
    return nearest;
  }

  update(delta, playerPos = null) {
    for (const door of this.doors) {
      const diff = door.targetAngle - door.currentAngle;
      if (Math.abs(diff) > 0.001) {
        door.currentAngle += diff * Math.min(1, 6 * delta);
        door.pivot.rotation.y = door.currentAngle;
      }
    }
    if (playerPos) {
      for (const room of this.rooms) {
        room.light.intensity += (room.litIntensity - room.light.intensity) * Math.min(1, 2 * delta);
      }
    }
  }
}
