import * as THREE from 'three';

const WALL_H = 3;
const WALL_T = 0.3;
const DOOR_W = 1.5;
const ROOM_Z_MIN = -4;
const ROOM_Z_MAX = 4;

/**
 * Temporary one-storey, 3-room test building — lets you build and test
 * movement, camera, jumping and door interaction before Sino's real museum
 * geometry exists. Swap this whole file out later: PlayerController only
 * depends on getColliders() and tryInteract(), so nothing else has to change.
 *
 * Top-down layout (+x east, +z south), each room roughly 6x8:
 *   Room 1 [x -9..-3]  --door-->  Room 2 [x -3..3]  --door-->  Room 3 [x 3..9]
 */
export class TestLevel {
  constructor(scene) {
    this.scene = scene;
    this.wallColliders = []; // THREE.Box3[] — static walls, always block
    this.doors = [];         // { pivot, collider, isOpen, currentAngle, targetAngle }

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.85 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.7 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x24262e, roughness: 0.9 });

    // --- floor ---
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 8), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // --- outer perimeter walls ---
    this._wall(wallMat, -9, 9, ROOM_Z_MIN, ROOM_Z_MIN + WALL_T); // north
    this._wall(wallMat, -9, 9, ROOM_Z_MAX - WALL_T, ROOM_Z_MAX); // south
    this._wall(wallMat, -9, -9 + WALL_T, ROOM_Z_MIN, ROOM_Z_MAX); // west end cap
    this._wall(wallMat, 9 - WALL_T, 9, ROOM_Z_MIN, ROOM_Z_MAX);   // east end cap

    // --- two dividing walls, each with a centred doorway ---
    this._dividerWithDoor(wallMat, doorMat, -3);
    this._dividerWithDoor(wallMat, doorMat, 3);

    // --- one point light per room, stand-in for later room-by-room lighting ---
    [-6, 0, 6].forEach((x) => {
      const light = new THREE.PointLight(0xffe8c0, 0.9, 10);
      light.position.set(x, 2.4, 0);
      light.castShadow = true;
      scene.add(light);
    });
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
    // solid wall segments above and below the doorway gap
    this._wall(wallMat, x - WALL_T / 2, x + WALL_T / 2, ROOM_Z_MIN, -gapHalf);
    this._wall(wallMat, x - WALL_T / 2, x + WALL_T / 2, gapHalf, ROOM_Z_MAX);

    // hinged door filling the gap, pivoting at its edge (z = -gapHalf)
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, -gapHalf);
    this.scene.add(pivot);

    const doorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(WALL_T, WALL_H, DOOR_W),
      doorMat
    );
    doorMesh.position.set(0, WALL_H / 2, gapHalf); // offsets the mesh so the pivot sits at the hinge edge
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
    this.wallColliders.push(door.collider); // closed by default: blocks movement like a wall
  }

  /** Boxes that currently block the player: all walls, plus any closed door. */
  getColliders() {
    return this.wallColliders.filter((box) => {
      const door = this.doors.find((d) => d.collider === box);
      return !door || !door.isOpen;
    });
  }

  /** Call on E press. Opens/closes the nearest door within range, if any. */
  tryInteract(playerPos) {
    const RANGE = 1.6;
    let nearest = null;
    let nearestDist = Infinity;
    for (const door of this.doors) {
      const dist = playerPos.distanceTo(door.pivot.position);
      if (dist < RANGE && dist < nearestDist) {
        nearest = door;
        nearestDist = dist;
      }
    }
    if (nearest) {
      nearest.isOpen = !nearest.isOpen;
      nearest.targetAngle = nearest.isOpen ? nearest.openAngle : 0;
    }
    return nearest;
  }

  /** Call every frame to animate any door currently swinging open/closed. */
  update(delta) {
    for (const door of this.doors) {
      const diff = door.targetAngle - door.currentAngle;
      if (Math.abs(diff) > 0.001) {
        door.currentAngle += diff * Math.min(1, 6 * delta);
        door.pivot.rotation.y = door.currentAngle;
      }
    }
  }
}
