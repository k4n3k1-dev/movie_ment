import * as THREE from 'three';

const WALL_H = 3;
const WALL_T = 0.3;
const DOOR_W = 3.75;      // 1.5 * 2.5
const ROOM_W = 15;        // 6 * 2.5 — width of each room along x
const ROOM_Z_MIN = -10;   // depth 8 * 2.5 = 20 total
const ROOM_Z_MAX = 10;
const OUTER_X_MIN = -1.5 * ROOM_W; // 3 rooms side by side, centred on x=0
const OUTER_X_MAX = 1.5 * ROOM_W;
const INTERACT_RANGE = 2.2; // scaled up slightly for the bigger rooms

/**
 * Temporary one-storey, 3-room test building — lets you build and test
 * movement, camera, jumping, door interaction and room lighting before
 * Sino's real museum geometry exists. Swap this whole file out later:
 * PlayerController only depends on getColliders() and tryInteract().
 *
 * Top-down layout (+x east, +z south), each room 15 x 20:
 *   Room 1 [-22.5..-7.5]  --door-->  Room 2 [-7.5..7.5]  --door-->  Room 3 [7.5..22.5]
 */
export class TestLevel {
  constructor(scene) {
    this.scene = scene;
    this.wallColliders = [];
    this.doors = [];
    this.rooms = []; // { xMin, xMax, light, baseIntensity, litIntensity }

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.85 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.7 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x24262e, roughness: 0.9 });

    // --- floor ---
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(OUTER_X_MAX - OUTER_X_MIN, ROOM_Z_MAX - ROOM_Z_MIN),
      floorMat
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // --- outer perimeter walls ---
    this._wall(wallMat, OUTER_X_MIN, OUTER_X_MAX, ROOM_Z_MIN, ROOM_Z_MIN + WALL_T); // north
    this._wall(wallMat, OUTER_X_MIN, OUTER_X_MAX, ROOM_Z_MAX - WALL_T, ROOM_Z_MAX); // south
    this._wall(wallMat, OUTER_X_MIN, OUTER_X_MIN + WALL_T, ROOM_Z_MIN, ROOM_Z_MAX); // west cap
    this._wall(wallMat, OUTER_X_MAX - WALL_T, OUTER_X_MAX, ROOM_Z_MIN, ROOM_Z_MAX); // east cap

    // --- two dividing walls, each with a centred doorway ---
    const divider1X = OUTER_X_MIN + ROOM_W;
    const divider2X = OUTER_X_MIN + ROOM_W * 2;
    this._dividerWithDoor(wallMat, doorMat, divider1X);
    this._dividerWithDoor(wallMat, doorMat, divider2X);

    // --- per-room night lighting: dim until the player enters, then brightens ---
    const roomBounds = [
      [OUTER_X_MIN, divider1X],
      [divider1X, divider2X],
      [divider2X, OUTER_X_MAX],
    ];
    for (const [xMin, xMax] of roomBounds) {
      const light = new THREE.PointLight(0xffe0b0, 0.35, 30);
      light.position.set((xMin + xMax) / 2, 2.6, 0);
      light.castShadow = true;
      scene.add(light);
      this.rooms.push({ xMin, xMax, light, baseIntensity: 0.35, litIntensity: 1.9 });
    }
  }

  _wall(mat, x0, x1, z0, z1) {
    const w = x1 - x0;
    const d = z1 - z0;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, d), mat);
    mesh.position.set((x0 + x1) / 2, WALL_H / 2, (z0 + z1) / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const box = new THREE.Box3(
      new THREE.Vector3(x0, 0, z0),
      new THREE.Vector3(x1, WALL_H, z1)
    );
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

    const doorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(WALL_T, WALL_H, DOOR_W),
      doorMat
    );
    doorMesh.position.set(0, WALL_H / 2, gapHalf);
    doorMesh.castShadow = true;
    pivot.add(doorMesh);

    const door = {
      pivot,
      collider: new THREE.Box3(
        new THREE.Vector3(x - WALL_T / 2, 0, -gapHalf),
        new THREE.Vector3(x + WALL_T / 2, WALL_H, gapHalf)
      ),
      isOpen: false,
      currentAngle: 0,
      targetAngle: 0,
      openAngle: (Math.PI / 2) * 0.85,
    };
    this.doors.push(door);
    this.wallColliders.push(door.collider);
  }

  getColliders() {
    return this.wallColliders.filter((box) => {
      const door = this.doors.find((d) => d.collider === box);
      return !door || !door.isOpen;
    });
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

  /** True if a door is close enough to interact with — drives the on-screen "E" prompt. */
  hasNearbyDoor(playerPos) {
    return !!this._nearestDoor(playerPos, INTERACT_RANGE);
  }

  /** Call on E press. Opens/closes the nearest door within range, if any. */
  tryInteract(playerPos) {
    const nearest = this._nearestDoor(playerPos, INTERACT_RANGE);
    if (nearest) {
      nearest.isOpen = !nearest.isOpen;
      nearest.targetAngle = nearest.isOpen ? nearest.openAngle : 0;
    }
    return nearest;
  }

  /** Call every frame: animates doors and brightens the room the player is standing in. */
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
        const inRoom = playerPos.x >= room.xMin && playerPos.x <= room.xMax;
        const target = inRoom ? room.litIntensity : room.baseIntensity;
        room.light.intensity += (target - room.light.intensity) * Math.min(1, 4 * delta);
      }
    }
  }
}
