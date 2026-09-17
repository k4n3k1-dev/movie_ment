import * as THREE from 'three';

const HOUSE = { x0: -10, x1: 10, z0: -7, z1: 7 };
const WALL_H = 3.2;
const WALL_T = 0.22;
const DOOR_W = 1.05;
const INTERACT_RANGE = 2.5;

/**
 * Procedural residential environment. Everything is generated with Three.js
 * primitives and canvas textures so the project remains dependency-free.
 */
export class TestLevel {
  constructor(scene) {
    this.scene = scene;
    this.wallColliders = [];
    this.doors = [];
    this.platforms = [];
    this.crawlObstacles = [];
    this.rooms = [];
    this._materials = {};

    this._buildGroundAndYard();
    this._buildHouse();
    this._buildFurniture();
    this._buildYardDetails();
    this._buildLighting();
  }

  _mat(key, color, roughness = 0.75, metalness = 0) {
    if (!this._materials[key]) {
      this._materials[key] = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    }
    return this._materials[key];
  }

  _mesh(geometry, material, x, y, z, parent = this.scene) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  _box(name, x, y, z, w, h, d, material, options = {}) {
    const mesh = this._mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z);
    mesh.name = name;
    if (options.collider !== false) {
      const box = new THREE.Box3(
        new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
        new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2)
      );
      if (options.climbable) box.userData = { isClimbable: true };
      this.wallColliders.push(box);
      if (options.climbable) this.platforms.push(box);
    }
    return mesh;
  }

  _buildGroundAndYard() {
    const grass = this._makeGrassMaterial();
    const ground = this._mesh(new THREE.PlaneGeometry(80, 70), grass, 0, -0.03, 0);
    ground.rotation.x = -Math.PI / 2;

    // Stone path from the player spawn to the front door.
    const pathMat = this._makeStoneMaterial();
    for (let z = -18; z < -6; z += 1.25) {
      this._mesh(new THREE.BoxGeometry(2.0, 0.07, 1.0), pathMat, 0, 0.02, z);
    }

    // Low garden border around the front planting beds.
    const border = this._mat('border', 0x77736a, 0.9);
    for (const x of [-13, 13]) this._box('garden-border', x, 0.16, -10, 0.28, 0.32, 10, border);
    this._box('garden-border-front', 0, 0.16, -15, 26, 0.32, 0.28, border);

    // Porch slab and steps.
    const concrete = this._mat('concrete', 0xb7b5ad, 0.9);
    this._box('porch', 0, 0.08, -7.75, 5.0, 0.16, 1.5, concrete, { collider: false });
    this._box('step-1', 0, 0.12, -8.55, 3.4, 0.24, 0.55, concrete);
    this._box('step-2', 0, 0.06, -9.05, 4.0, 0.12, 0.55, concrete);
  }

  _buildHouse() {
    const plaster = this._mat('plaster', 0xd7d1c4, 0.86);
    const trim = this._mat('trim', 0xeee9de, 0.72);
    const darkTrim = this._mat('darkTrim', 0x3b3d3d, 0.48);
    const roofMat = this._mat('roof', 0x3d4244, 0.9);
    const glass = new THREE.MeshStandardMaterial({ color: 0x8fb8c4, roughness: 0.2, metalness: 0.15, transparent: true, opacity: 0.62 });

    // Main walls: a deliberately irregular, realistic floor plan.
    // Front: living room + kitchen; rear: two bedrooms + bathroom.
    this._wall(plaster, HOUSE.x0, -2.8, HOUSE.z0, HOUSE.z0 + WALL_T);
    this._wall(plaster, -2.8, 4.2, HOUSE.z0, HOUSE.z0 + WALL_T);
    this._wall(plaster, 4.2, HOUSE.x1, HOUSE.z0, HOUSE.z0 + WALL_T);
    this._wall(plaster, HOUSE.x0, HOUSE.x0 + WALL_T, HOUSE.z0, HOUSE.z1);
    this._wall(plaster, HOUSE.x1 - WALL_T, HOUSE.x1, -7, 1.0);
    this._wall(plaster, HOUSE.x1 - WALL_T, HOUSE.x1, 2.15, HOUSE.z1);
    this._wall(plaster, HOUSE.x0, HOUSE.x1, HOUSE.z1 - WALL_T, HOUSE.z1);

    // Interior plan: kitchen to left, living front-middle, bedrooms rear,
    // bathroom tucked into the right wing rather than forming one straight row.
    this._dividerWithDoor(plaster, trim, -2.8, -2.0, 'Kitchen Door');
    this._dividerWithDoor(plaster, trim, 4.2, -3.3, 'Bathroom Door', true);
    this._dividerWithDoor(plaster, trim, -2.0, 1.8, 'Bedroom 1 Door');
    this._dividerWithDoor(plaster, trim, 4.2, 1.2, 'Bedroom 2 Door');

    // Front door is on the south wall. Its opening is centered on the porch.
    this._frontDoor(plaster, trim, darkTrim);

    // Roof slab + shallow pitched-looking sections made from beams.
    const roof = this._box('roof', 0, 3.48, 0, 20.7, 0.35, 14.7, roofMat, { collider: false });
    roof.castShadow = true;
    const ridge = this._box('roof-ridge', 0, 4.0, 0, 0.35, 0.35, 15.2, roofMat, { collider: false });
    ridge.rotation.z = 0.01;

    // Windows are grouped with frames and sills. They are decorative, while
    // the surrounding wall remains the collision boundary.
    const windows = [
      [-6.9, -6.98, 1.45, 1.35, 'front'], [-0.2, -6.98, 1.55, 1.35, 'front'], [6.7, -6.98, 1.25, 1.2, 'front'],
      [-9.88, -3.5, 1.35, 1.4, 'side'], [-9.88, 3.8, 1.35, 1.4, 'side'],
      [9.88, -4.7, 1.25, 1.3, 'side'], [9.88, 4.5, 1.25, 1.3, 'side'],
      [-6.2, 6.88, 1.5, 1.3, 'rear'], [0.3, 6.88, 1.5, 1.3, 'rear'], [6.6, 6.88, 1.15, 1.15, 'rear']
    ];
    for (const [x, z, w, h, side] of windows) this._window(x, z, w, h, side, glass, trim, darkTrim);

    // Exterior front awning.
    this._box('awning', 0, 3.0, -8.15, 5.6, 0.14, 1.65, roofMat, { collider: false });
    for (const x of [-2.45, 2.45]) this._box('awning-post', x, 1.5, -8.75, 0.12, 3, 0.12, trim, { collider: false });

    this.rooms.push(
      { name: 'Living Room', xMin: -2.8, xMax: 4.2, zMin: -7, zMax: 1 },
      { name: 'Kitchen', xMin: -10, xMax: -2.8, zMin: -7, zMax: 1 },
      { name: 'Bedroom 1', xMin: -10, xMax: -2, zMin: 1, zMax: 7 },
      { name: 'Bedroom 2', xMin: -2, xMax: 4.2, zMin: 1, zMax: 7 },
      { name: 'Bathroom', xMin: 4.2, xMax: 10, zMin: -7, zMax: 1 }
    );
  }

  _wall(mat, x0, x1, z0, z1) {
    const w = x1 - x0;
    const d = z1 - z0;
    if (w <= 0 || d <= 0) return null;
    const mesh = this._mesh(new THREE.BoxGeometry(w, WALL_H, d), mat, (x0 + x1) / 2, WALL_H / 2, (z0 + z1) / 2);
    this.wallColliders.push(new THREE.Box3(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, WALL_H, z1)));
    return mesh;
  }

  _dividerWithDoor(wallMat, trimMat, x, doorZ, name, narrow = false) {
    const doorW = narrow ? 0.9 : DOOR_W;
    const half = doorW / 2;
    this._wall(wallMat, x - WALL_T / 2, x + WALL_T / 2, 1, doorZ - half);
    this._wall(wallMat, x - WALL_T / 2, x + WALL_T / 2, doorZ + half, HOUSE.z1);

    const frame = this._doorFrame(x, doorZ, doorW, trimMat);
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, doorZ - half);
    this.scene.add(pivot);
    const doorMat = this._mat(`door-${name}`, 0x6d4c35, 0.7);
    const door = this._mesh(new THREE.BoxGeometry(WALL_T * 0.72, 2.45, doorW), doorMat, 0, 1.225, half, pivot);
    door.name = name;
    const handle = this._mesh(new THREE.SphereGeometry(0.055, 10, 8), this._mat('handle', 0xb38b54, 0.3, 0.65), x > 0 ? -0.32 : 0.32, 1.15, doorZ + half - 0.08, pivot);
    handle.scale.set(1, 1, 1.4);

    const collider = new THREE.Box3(new THREE.Vector3(x - WALL_T / 2, 0, doorZ - half), new THREE.Vector3(x + WALL_T / 2, WALL_H, doorZ + half));
    this.doors.push({ pivot, collider, isOpen: false, currentAngle: 0, targetAngle: 0, openAngle: x > 0 ? -Math.PI * 0.46 : Math.PI * 0.46, frame });
    this.wallColliders.push(collider);
  }

  _frontDoor(wallMat, trimMat, darkTrim) {
    const x = 0;
    const gap = 1.45;
    this._wall(wallMat, HOUSE.x0, -gap / 2, HOUSE.z0, HOUSE.z0 + WALL_T);
    this._wall(wallMat, gap / 2, HOUSE.x1, HOUSE.z0, HOUSE.z0 + WALL_T);
    const pivot = new THREE.Group();
    pivot.position.set(-gap / 2, 0, HOUSE.z0 + WALL_T / 2);
    this.scene.add(pivot);
    const doorMat = this._mat('frontDoor', 0x4d3527, 0.62);
    const door = this._mesh(new THREE.BoxGeometry(0.12, 2.65, gap), doorMat, 0, 1.325, gap / 2, pivot);
    door.name = 'Front Door';
    this._mesh(new THREE.SphereGeometry(0.06, 12, 8), this._mat('frontHandle', 0xd3a85c, 0.25, 0.7), 0.1, 1.25, 0.17, pivot);
    const frame = this._doorFrame(0, HOUSE.z0 + 0.01, gap, trimMat, true);
    const collider = new THREE.Box3(new THREE.Vector3(-gap / 2, 0, HOUSE.z0 - 0.04), new THREE.Vector3(gap / 2, WALL_H, HOUSE.z0 + 0.18));
    this.doors.push({ pivot, collider, isOpen: false, currentAngle: 0, targetAngle: 0, openAngle: -Math.PI * 0.48, frame });
    this.wallColliders.push(collider);
    // Decorative house number plaque.
    this._box('number-plaque', 0, 1.85, HOUSE.z0 - 0.17, 0.62, 0.42, 0.035, darkTrim, { collider: false });
  }

  _doorFrame(x, z, width, mat, front = false) {
    const y = 1.35;
    if (front) {
      this._box('frame', x - width / 2 - 0.08, y, z, 0.16, 2.8, 0.16, mat, { collider: false });
      this._box('frame', x + width / 2 + 0.08, y, z, 0.16, 2.8, 0.16, mat, { collider: false });
      this._box('lintel', x, 2.72, z, width + 0.32, 0.16, 0.16, mat, { collider: false });
    } else {
      this._box('frame', x, y, z - width / 2 - 0.06, 0.14, 2.7, 0.12, mat, { collider: false });
      this._box('frame', x, y, z + width / 2 + 0.06, 0.14, 2.7, 0.12, mat, { collider: false });
      this._box('lintel', x, 2.72, z, 0.14, 0.16, width + 0.28, mat, { collider: false });
    }
  }

  _window(x, z, w, h, side, glass, trim, darkTrim) {
    const vertical = side === 'side';
    const frameDepth = 0.09;
    const frameW = 0.1;
    const sillY = 1.15;
    if (vertical) {
      this._box('window-glass', x, sillY + h / 2, z, frameDepth, h, w, glass, { collider: false });
      for (const dz of [-w / 2, w / 2]) this._box('window-frame', x, sillY + h / 2, z + dz, 0.16, h + 0.18, frameW, trim, { collider: false });
      for (const y of [sillY, sillY + h]) this._box('window-frame', x, y, z, 0.16, frameW, w + 0.18, trim, { collider: false });
      this._box('window-mullion', x - 0.04, sillY + h / 2, z, 0.04, h, 0.04, darkTrim, { collider: false });
    } else {
      this._box('window-glass', x, sillY + h / 2, z, w, h, frameDepth, glass, { collider: false });
      for (const dx of [-w / 2, w / 2]) this._box('window-frame', x + dx, sillY + h / 2, z, frameW, h + 0.18, 0.16, trim, { collider: false });
      for (const y of [sillY, sillY + h]) this._box('window-frame', x, y, z, w + 0.18, frameW, 0.16, trim, { collider: false });
      this._box('window-mullion', x, sillY + h / 2, z - 0.04, 0.04, h, 0.04, darkTrim, { collider: false });
    }
  }

  _buildFurniture() {
    this._buildLivingRoom();
    this._buildKitchen();
    this._buildBedroom1();
    this._buildBedroom2();
    this._buildBathroom();
  }

  _buildLivingRoom() {
    const wood = this._mat('wood', 0x7b5335, 0.72);
    const leather = this._mat('leather', 0x303436, 0.62);
    const fabric = this._mat('fabric', 0x777a76, 0.92);
    const rug = this._makeRugMaterial();
    this._mesh(new THREE.BoxGeometry(5.3, 0.035, 4.0), rug, 0.6, 0.02, -3.0);

    // Sofa: climbable seat, but the back remains a normal collision object.
    this._sofa(0.0, -4.85, 3.8, leather);
    this._box('coffee-table-top', 0.9, 0.72, -2.9, 1.7, 0.16, 1.0, wood, { climbable: true });
    for (const x of [0.25, 1.55]) for (const z of [-3.25, -2.55]) this._box('table-leg', x, 0.36, z, 0.09, 0.65, 0.09, wood, { collider: false });
    this._box('tv-unit', 2.75, 0.5, 0.2, 2.2, 0.9, 0.45, wood);
    const tv = this._box('television', 2.75, 1.65, 0.08, 2.25, 1.3, 0.12, this._mat('tv', 0x111416, 0.18, 0.45), { collider: false });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 0.95), new THREE.MeshStandardMaterial({ color: 0x182a33, emissive: 0x10202a, emissiveIntensity: 0.35, roughness: 0.2 }));
    screen.position.set(2.75, 1.65, 0.15);
    this.scene.add(screen);
    this._plant(2.8, -5.7, 0.75);
  }

  _sofa(x, z, w, mat) {
    const seat = this._box('sofa-seat', x, 0.5, z, w, 0.55, 1.15, mat, { climbable: true });
    this._box('sofa-back', x, 1.2, z + 0.45, w, 1.55, 0.28, mat);
    this._box('sofa-arm-l', x - w / 2 + 0.18, 0.9, z, 0.32, 1.0, 1.18, mat);
    this._box('sofa-arm-r', x + w / 2 - 0.18, 0.9, z, 0.32, 1.0, 1.18, mat);
    return seat;
  }

  _buildKitchen() {
    const cabinet = this._mat('cabinet', 0x7d6853, 0.68);
    const counter = this._mat('counter', 0x3f4442, 0.34, 0.12);
    const steel = this._mat('steel', 0x8d9494, 0.27, 0.65);
    const ceramic = this._mat('ceramic', 0xd8d4c8, 0.42);
    for (let x = -9.2; x <= -3.8; x += 1.05) {
      this._box('kitchen-base', x, 0.45, -6.35, 0.9, 0.9, 0.72, cabinet);
      this._box('kitchen-counter', x, 0.96, -6.35, 0.98, 0.12, 0.82, counter, { climbable: true });
    }
    this._box('upper-cabinet', -8.6, 2.25, -6.55, 1.6, 1.2, 0.45, cabinet);
    this._box('upper-cabinet', -6.6, 2.25, -6.55, 1.6, 1.2, 0.45, cabinet);
    // Refrigerator is intentionally non-climbable.
    this._box('refrigerator', -9.2, 1.45, -4.55, 1.15, 2.9, 0.95, steel);
    this._box('fridge-handle', -8.67, 1.5, -4.02, 0.06, 1.55, 0.04, counter, { collider: false });
    // Oven and sink details.
    this._box('oven', -4.2, 0.72, -6.35, 0.9, 1.44, 0.72, steel);
    this._box('oven-glass', -4.2, 0.68, -5.97, 0.65, 0.45, 0.035, this._mat('ovenGlass', 0x1a2020, 0.2, 0.35), { collider: false });
    this._box('sink', -5.25, 1.03, -6.35, 1.0, 0.08, 0.62, ceramic, { climbable: true });
    this._mesh(new THREE.TorusGeometry(0.13, 0.025, 8, 20), steel, -5.25, 1.25, -6.35);
    this._box('dining-table', -6.6, 0.75, -3.6, 2.4, 0.14, 1.25, cabinet, { climbable: true });
    for (const x of [-7.55, -5.65]) for (const z of [-4.05, -3.15]) this._box('chair', x, 0.45, z, 0.45, 0.8, 0.45, cabinet, { climbable: true });
  }

  _buildBedroom1() {
    const wood = this._mat('bedwood', 0x5e4938, 0.72);
    const linen = this._mat('linen1', 0xb9b0a1, 0.95);
    this._bed(-6.6, 4.55, 2.9, linen, wood);
    this._wardrobe(-8.9, 3.0, 2.4);
    this._desk(-3.55, 5.7, wood);
    this._plant(-9.0, 6.0, 0.55);
  }

  _buildBedroom2() {
    const wood = this._mat('bedwood2', 0x473b31, 0.74);
    const linen = this._mat('linen2', 0x9fa8ad, 0.96);
    this._bed(0.35, 4.55, 2.9, linen, wood);
    this._wardrobe(3.35, 5.85, 2.3);
    this._desk(-1.0, 6.0, wood);
    this._plant(3.45, 2.0, 0.55);
  }

  _bed(x, z, length, linen, wood) {
    this._box('bed-base', x, 0.35, z, 2.4, 0.45, length, wood);
    this._box('mattress', x, 0.68, z, 2.25, 0.25, length - 0.1, linen, { climbable: true });
    this._box('headboard', x, 1.55, z + length / 2 - 0.12, 2.4, 1.8, 0.18, wood);
    this._box('pillow', x - 0.58, 0.87, z + length / 2 - 0.65, 0.9, 0.18, 0.55, this._mat('pillow', 0xe6e2da, 0.96), { collider: false });
    this._box('pillow', x + 0.58, 0.87, z + length / 2 - 0.65, 0.9, 0.18, 0.55, this._mat('pillow2', 0xe6e2da, 0.96), { collider: false });
  }

  _wardrobe(x, z, h) {
    // Wardrobes are deliberately NOT climbable.
    const wood = this._mat('wardrobe', 0x594a3c, 0.78);
    this._box('wardrobe', x, h / 2, z, 1.2, h, 0.75, wood);
    for (const dx of [-0.27, 0.27]) this._box('wardrobe-door', x + dx, h / 2, z - 0.39, 0.48, h - 0.12, 0.035, this._mat('wardrobeDoor', 0x675646, 0.75), { collider: false });
  }

  _desk(x, z, wood) {
    this._box('desk-top', x, 0.78, z, 1.6, 0.14, 0.72, wood, { climbable: true });
    for (const dx of [-0.68, 0.68]) this._box('desk-leg', x + dx, 0.38, z, 0.1, 0.72, 0.1, wood, { collider: false });
    this._box('desk-monitor', x, 1.32, z + 0.02, 0.9, 0.55, 0.08, this._mat('monitor', 0x202426, 0.25, 0.25), { collider: false });
  }

  _buildBathroom() {
    const ceramic = this._mat('bathCeramic', 0xe5e2da, 0.38);
    const dark = this._mat('bathDark', 0x4e5555, 0.42);
    this._box('bath-tub', 7.35, 0.45, -4.75, 2.7, 0.9, 1.3, ceramic, { climbable: true });
    this._box('tub-inside', 7.35, 0.91, -4.75, 2.25, 0.08, 0.9, this._mat('water', 0x9fb8bc, 0.2, 0.05), { collider: false });
    this._box('bath-sink', 5.35, 0.78, -2.15, 1.2, 0.9, 0.6, ceramic, { climbable: true });
    this._box('bath-mirror', 5.35, 1.95, -1.8, 1.05, 1.2, 0.06, this._mat('mirror', 0xaab9ba, 0.12, 0.75), { collider: false });
    this._box('toilet', 8.85, 0.48, -2.0, 0.8, 0.65, 1.15, ceramic);
    this._box('toilet-tank', 8.85, 1.05, -1.55, 0.72, 0.9, 0.35, ceramic);
    this._box('bath-mat', 7.35, 0.025, -2.0, 2.5, 0.04, 1.0, dark, { collider: false });
  }

  _plant(x, z, height = 0.8) {
    const pot = this._mat('pot', 0x725643, 0.82);
    const leaf = this._mat('leaf', 0x47694b, 0.9);
    this._mesh(new THREE.CylinderGeometry(0.25, 0.32, 0.38, 12), pot, x, 0.19, z);
    const crown = new THREE.Group();
    crown.position.set(x, 0.4, z);
    this.scene.add(crown);
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI * 2 / 7;
      const leafMesh = this._mesh(new THREE.SphereGeometry(0.23, 10, 8), leaf, 0, 0, 0, crown);
      leafMesh.scale.set(0.7, 1.6, 0.7);
      leafMesh.position.set(Math.cos(a) * 0.28, height * 0.42 + Math.sin(i * 2) * 0.05, Math.sin(a) * 0.28);
    }
  }

  _buildYardDetails() {
    const trunk = this._mat('treeTrunk', 0x60432e, 0.95);
    const bark = this._mat('bark2', 0x4e3929, 1.0);
    const foliage = this._mat('foliage', 0x3f6844, 0.96);
    const foliage2 = this._mat('foliage2', 0x567c4c, 0.96);
    const trees = [
      [-17, -7, 4.8], [16, -9, 5.6], [-15, 8, 4.4], [15, 9, 5.0], [-18, 15, 6.2], [18, 15, 5.8]
    ];
    for (const [x, z, h] of trees) this._tree(x, z, h, trunk, bark, foliage, foliage2);

    // Shrub beds and flowers around the front yard.
    for (const x of [-11.5, -9.8, 8.8, 10.5]) {
      for (let i = 0; i < 5; i++) this._shrub(x + (i - 2) * 0.42, -10.8 + Math.sin(i) * 0.35, foliage2);
    }
    this._bench(-11.7, -6.9);
    this._mailbox(3.8, -10.7);
    this._lampPost(-4.0, -10.6);
    this._lampPost(8.0, -10.6);
  }

  _tree(x, z, h, trunk, bark, foliage, foliage2) {
    this._mesh(new THREE.CylinderGeometry(0.25, 0.42, h, 10), trunk, x, h / 2, z);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI * 2 / 8;
      const r = 0.9 + (i % 3) * 0.2;
      const y = h * 0.65 + (i % 3) * 0.45;
      const leaf = this._mesh(new THREE.SphereGeometry(1.15, 12, 9), i % 2 ? foliage : foliage2, x + Math.cos(a) * r, y, z + Math.sin(a) * r);
      leaf.scale.set(1.0, 0.82, 1.0);
    }
    this._mesh(new THREE.SphereGeometry(1.35, 12, 9), bark, x, h * 0.82, z);
  }

  _shrub(x, z, mat) {
    this._mesh(new THREE.SphereGeometry(0.48, 10, 8), mat, x, 0.42, z).scale.set(1.2, 0.8, 1.2);
  }

  _bench(x, z) {
    const wood = this._mat('bench', 0x6b4c35, 0.8);
    this._box('bench-seat', x, 0.7, z, 2.1, 0.16, 0.55, wood, { climbable: true });
    this._box('bench-back', x, 1.2, z + 0.2, 2.1, 0.85, 0.12, wood, { collider: false });
    for (const dx of [-0.78, 0.78]) this._box('bench-leg', x + dx, 0.35, z, 0.1, 0.65, 0.1, wood, { collider: false });
  }

  _mailbox(x, z) {
    const metal = this._mat('mailbox', 0x596168, 0.35, 0.45);
    this._box('mailbox-post', x, 0.65, z, 0.12, 1.3, 0.12, this._mat('post', 0x5c4938, 0.9), { collider: false });
    this._mesh(new THREE.BoxGeometry(0.72, 0.5, 0.45), metal, x, 1.3, z, this.scene).rotation.x = 0;
    this._mesh(new THREE.SphereGeometry(0.36, 12, 8), metal, x, 1.55, z).scale.set(1, 0.72, 0.63);
  }

  _lampPost(x, z) {
    const metal = this._mat('lampMetal', 0x303437, 0.38, 0.65);
    const warm = new THREE.MeshStandardMaterial({ color: 0xffe9bd, emissive: 0x5a3f1f, emissiveIntensity: 0.15, roughness: 0.3 });
    this._mesh(new THREE.CylinderGeometry(0.045, 0.07, 2.2, 10), metal, x, 1.1, z);
    this._mesh(new THREE.SphereGeometry(0.14, 12, 8), warm, x, 2.25, z);
  }

  _buildLighting() {
    const warm = 0xffe6c5;
    for (const room of this.rooms) {
      const cx = (room.xMin + room.xMax) / 2;
      const cz = (room.zMin + room.zMax) / 2;
      const light = new THREE.PointLight(warm, 0.7, 10);
      light.position.set(cx, 2.7, cz);
      light.castShadow = false;
      this.scene.add(light);
      room.light = light;
    }
    const porch = new THREE.PointLight(0xffdfad, 0.45, 7);
    porch.position.set(0, 2.7, -7.8);
    this.scene.add(porch);
  }

  _makeGrassMaterial() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#52734b';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      ctx.fillStyle = i % 3 === 0 ? '#66855a' : '#456441';
      ctx.fillRect(x, y, 1 + Math.random() * 2, 2 + Math.random() * 5);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(18, 16);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
  }

  _makeStoneMaterial() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#a7a59d';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 600; i++) {
      const g = 130 + Math.random() * 50;
      ctx.fillStyle = `rgb(${g},${g},${g - 4})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.96 });
  }

  _makeRugMaterial() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#6e6255';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#a59a88';
    ctx.lineWidth = 5;
    ctx.strokeRect(8, 8, 240, 240);
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath(); ctx.moveTo(15, 20 + i * 16); ctx.lineTo(241, 20 + i * 16); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
  }

  getColliders() {
    const doorBoxes = new Set(this.doors.map((d) => d.collider));
    return [...this.wallColliders, ...this.crawlObstacles].filter((box) => !doorBoxes.has(box) || !this.doors.find((d) => d.collider === box)?.isOpen);
  }

  getGroundHeight(position, radius, previousY = position.y, velocityY = 0) {
    let ground = 0;
    if (velocityY <= 0) {
      for (const box of this.platforms) {
        const overlapX = position.x + radius > box.min.x && position.x - radius < box.max.x;
        const overlapZ = position.z + radius > box.min.z && position.z - radius < box.max.z;
        if (!overlapX || !overlapZ) continue;
        const crossed = previousY >= box.max.y - 0.12 && position.y <= box.max.y + 0.12;
        const standing = Math.abs(previousY - box.max.y) <= 0.12 && position.y <= box.max.y + 0.12;
        if (crossed || standing) ground = Math.max(ground, box.max.y);
      }
    }
    return ground;
  }

  isBlockedByLowCeiling() { return false; }

  _nearestDoor(playerPos, range) {
    let nearest = null;
    let dist = Infinity;
    for (const door of this.doors) {
      const d = playerPos.distanceTo(door.pivot.position);
      if (d < range && d < dist) { nearest = door; dist = d; }
    }
    return nearest;
  }

  hasNearbyDoor(playerPos) { return !!this._nearestDoor(playerPos, INTERACT_RANGE); }

  tryInteract(playerPos) {
    const door = this._nearestDoor(playerPos, INTERACT_RANGE);
    if (!door) return null;
    door.isOpen = !door.isOpen;
    door.targetAngle = door.isOpen ? door.openAngle : 0;
    return door;
  }

  update(delta) {
    for (const door of this.doors) {
      const diff = door.targetAngle - door.currentAngle;
      if (Math.abs(diff) > 0.001) {
        door.currentAngle += diff * Math.min(1, 7 * delta);
        door.pivot.rotation.y = door.currentAngle;
      }
    }
  }
}
