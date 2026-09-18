import * as THREE from 'three';

const WALL_H = 3.15;
const WALL_T = 0.22;
const DOOR_W = 1.55;
const INTERACT_RANGE = 2.25;

// A deliberately irregular, single-storey house. Coordinates are world-space.
const HOUSE = { x0: -12, x1: 12, z0: -8, z1: 10 };

export class TestLevel {
  constructor(scene) {
    this.scene = scene;
    this.wallColliders = [];
    this.doors = [];
    this.platforms = [];
    this.crawlObstacles = [];
    this.rooms = [];

    this._buildEnvironment();
    this._buildHouse();
    this._buildYard();
    this._buildFurniture();
  }

  _buildEnvironment() {
    const groundMat = this._grassMaterial();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(55, 48), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Subtle stone path outside the front door.
    const pathMat = this._material(0xaaa397, 0.95);
    for (let i = 0; i < 7; i++) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 1.25), pathMat);
      slab.position.set(-8.4 + i * 1.45, 0.04, 13.0 - i * 0.65);
      slab.rotation.y = (i % 2 ? 0.035 : -0.035);
      slab.receiveShadow = true;
      this.scene.add(slab);
    }

    // Daylight, soft fill and a warm interior bounce.
    const sun = new THREE.DirectionalLight(0xfff3d6, 3.1);
    sun.position.set(-14, 25, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -28;
    sun.shadow.camera.right = 28;
    sun.shadow.camera.top = 28;
    sun.shadow.camera.bottom = -28;
    sun.shadow.bias = -0.0002;
    this.scene.add(sun);

    const hemi = new THREE.HemisphereLight(0xdceeff, 0x66533f, 1.65);
    this.scene.add(hemi);

    const ambient = new THREE.AmbientLight(0xffe8c7, 0.22);
    this.scene.add(ambient);
  }

  _buildHouse() {
    const exterior = this._material(0xeadfca, 0.92);
    const trim = this._material(0x6b4a35, 0.72);
    const interior = this._material(0xd8cbb4, 0.9);
    const darkTrim = this._material(0x624532, 0.7);

    // Irregular five-room plan:
    // living west/centre, bedroom 1 north-west, bedroom 2 north-east,
    // kitchen east-centre, bathroom south-east.
    this._wall(exterior, HOUSE.x0, HOUSE.x1, HOUSE.z1 - WALL_T, HOUSE.z1, 'north');
    this._wall(exterior, HOUSE.x0, HOUSE.x0 + WALL_T, HOUSE.z0, HOUSE.z1, 'west');
    this._wall(exterior, HOUSE.x1 - WALL_T, HOUSE.x1, HOUSE.z0, HOUSE.z1, 'east');
    this._doorWall(exterior, trim, HOUSE.z0, HOUSE.x0, true);

    // Living ↔ bedroom 1.
    this._horizontalWallWithDoor(interior, darkTrim, -12, -2, 4, -6.8, 1.55);
    // Bedroom 2 ↔ kitchen.
    this._horizontalWallWithDoor(interior, darkTrim, 2, 12, 5, 6.0, 1.45);
    // Living ↔ kitchen. The wide opening sits off-centre.
    this._verticalWallWithDoor(interior, darkTrim, 2, -8, 4, 1.0, 1.8);
    // Kitchen ↔ bathroom. Door is near the bottom of the kitchen.
    this._verticalWallWithDoor(interior, darkTrim, 7.0, -8, 0, -4.0, 1.35);
    // Bedroom 1 ↔ small hall/entry notch, leaving a non-rectilinear circulation path.
    this._verticalWallWithDoor(interior, darkTrim, -2.0, 4, 10.0, 6.2, 1.35);
    // Bathroom north wall with a normal hinged doorway from the kitchen.
    this._horizontalWallWithDoor(interior, darkTrim, 7, 12, 0, 9.4, 1.25);

    // Warm wood floor only inside the house; the yard remains grass.
    const floorMat = this._woodMaterial();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(HOUSE.x1 - HOUSE.x0 - 0.1, HOUSE.z1 - HOUSE.z0 - 0.1), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.006, 1);
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Architectural trim and fascia.
    for (const [x, z, sx, sz] of [
      [0, HOUSE.z0 + 0.03, 24, 0.11], [0, HOUSE.z1 - 0.03, 24, 0.11],
      [HOUSE.x0 + 0.03, 1, 0.11, 18], [HOUSE.x1 - 0.03, 1, 0.11, 18]
    ]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.12, sz), darkTrim);
      beam.position.set(x, WALL_H - 0.16, z);
      beam.castShadow = true;
      this.scene.add(beam);
    }

    // Large framed windows let the daylight wash through the open-roof prototype.
    this._window(-8.0, HOUSE.z0 + 0.12, Math.PI / 2, 3.0, 1.5);
    this._window(-7.0, HOUSE.z1 - 0.12, Math.PI / 2, 3.5, 1.65);
    this._window(6.0, HOUSE.z1 - 0.12, Math.PI / 2, 3.2, 1.65);
    this._window(HOUSE.x1 - 0.12, 2.0, 0, 2.8, 1.5);

    this._roomLight(-7.5, 2.8, -3.0, 0xfff0d0);
    this._roomLight(-7.0, 2.8, 6.8, 0xffefd0);
    this._roomLight(7.0, 2.8, 7.6, 0xfff1d5);
    this._roomLight(9.2, 2.8, -4.5, 0xfff1d5);
    this._roomLight(1.0, 2.7, 1.0, 0xffe8c6);
  }

  _horizontalWallWithDoor(mat, trimMat, x0, x1, z, doorX, doorWidth) {
    const half = doorWidth / 2;
    this._wall(mat, x0, doorX - half, z - WALL_T / 2, z + WALL_T / 2, 'partition');
    this._wall(mat, doorX + half, x1, z - WALL_T / 2, z + WALL_T / 2, 'partition');
    this._interiorDoor(trimMat, doorX, z, Math.PI / 2);
  }

  _verticalWallWithDoor(mat, trimMat, x, z0, z1, doorZ, doorWidth) {
    const half = doorWidth / 2;
    this._wall(mat, x - WALL_T / 2, x + WALL_T / 2, z0, doorZ - half, 'partition');
    this._wall(mat, x - WALL_T / 2, x + WALL_T / 2, doorZ + half, z1, 'partition');
    this._interiorDoor(trimMat, x, doorZ, 0);
  }

  _buildYard() {
    // Mature trees built from multiple low-poly layers and textured bark.
    const treeSpots = [
      [-19, -9, 1.15], [-20, 5, 1.3], [-15, 17, 1.1], [-2, 17, 1.0],
      [15, 15, 1.25], [20, 4, 1.0], [19, -9, 1.35], [-18, 12, 0.9]
    ];
    for (const [x, z, scale] of treeSpots) this._tree(x, z, scale);

    // Garden beds and bushes.
    const soil = this._material(0x5c3d28, 1);
    const leaf = this._material(0x3d6d37, 0.92);
    for (const [x, z] of [[-15, -5], [15, -3], [-15, 9], [14, 11]]) {
      const bed = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 1.4), soil);
      bed.position.set(x, 0.06, z);
      bed.receiveShadow = true;
      this.scene.add(bed);
      for (let i = 0; i < 5; i++) {
        const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45 + (i % 2) * 0.12, 1), leaf);
        bush.position.set(x - 1.5 + i * 0.75, 0.45, z + (i % 2 ? 0.15 : -0.12));
        bush.scale.y = 0.8;
        bush.castShadow = true;
        this.scene.add(bush);
      }
    }

    // Simple low fence around the back yard.
    const fenceMat = this._material(0x8c6545, 0.9);
    for (let x = -21; x <= 21; x += 2.5) this._fencePost(fenceMat, x, 19, 0);
    for (let x = -21; x <= 21; x += 2.5) this._fencePost(fenceMat, x, -13, 0);
    for (let z = -13; z <= 19; z += 2.5) this._fencePost(fenceMat, -21, z, Math.PI / 2);
    for (let z = -13; z <= 19; z += 2.5) this._fencePost(fenceMat, 21, z, Math.PI / 2);
  }

  _buildFurniture() {
    // LIVING ROOM
    this._sofa(-7.2, -2.8, 0);
    this._coffeeTable(-7.0, -0.25);
    this._rug(-7.0, -1.0, 4.6, 3.2);
    this._tvUnit(-1.0, -5.8);
    this._plant(-10.1, -6.0, 1.0);

    // BEDROOM 1: bed and low dresser. Bed mattress is climbable.
    this._bed(-8.2, 5.0, Math.PI / 2);
    this._dresser(-10.6, 7.1, Math.PI / 2);
    this._bedside(-5.6, 5.0);
    this._crawlUnderFurniture(-8.2, 5.0, 4.2, 2.0, 0.98);

    // KITCHEN: fridge/cabinets are deliberately NOT climbable.
    this._kitchenCabinet(6.5, 8.1);
    this._counter(9.4, 8.0, 4.0);
    this._fridge(10.0, 4.9);
    this._diningTable(5.8, 3.0);
    for (const [x, z] of [[4.2, 2.0], [7.4, 2.0], [4.2, 4.0], [7.4, 4.0]]) this._chair(x, z);

    // BEDROOM 2: bed + low bench are climbable, wardrobe is not.
    this._bed(7.5, 8.0, 0);
    this._bench(7.5, 5.7, 2.4, 0.52);
    this._wardrobe(10.1, 8.0);
    this._bedside(5.5, 8.0);
    this._crawlUnderFurniture(7.5, 8.0, 4.3, 2.4, 0.98);

    // BATHROOM: low vanity is climbable; toilet/tub are not.
    this._vanity(7.0, -5.9);
    this._toilet(10.0, -5.4);
    this._bathtub(8.3, -2.5);

    // A couple of low storage benches make climbing routes feel intentional.
    this._bench(-1.5, 4.9, 2.1, 0.58);
    this._bench(0.0, -4.7, 1.8, 0.55);
  }

  _material(color, roughness = 0.75, metalness = 0) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }

  _grassMaterial() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#5f7f45'; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * 512, y = Math.random() * 512;
      const v = 70 + Math.floor(Math.random() * 50);
      ctx.fillStyle = `rgb(${42 + Math.floor(v * .25)},${72 + Math.floor(v * .45)},${35 + Math.floor(v * .18)})`;
      ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 4);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(14, 12);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.98 });
  }

  _woodMaterial() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#9a6b45'; ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 52) {
      ctx.fillStyle = y % 104 ? '#a9774c' : '#8e603d';
      ctx.fillRect(0, y, 512, 49);
      ctx.strokeStyle = 'rgba(55,31,16,.45)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, y + 50); ctx.lineTo(512, y + 50); ctx.stroke();
      for (let x = 12; x < 512; x += 115) {
        ctx.strokeStyle = 'rgba(65,38,21,.18)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y + 9); ctx.quadraticCurveTo(x + 25, y + 28, x - 5, y + 44); ctx.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(7, 6);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.76 });
  }

  _wall(mat, x0, x1, z0, z1, name = 'wall') {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, WALL_H, z1 - z0), mat);
    mesh.name = name;
    mesh.position.set((x0 + x1) / 2, WALL_H / 2, (z0 + z1) / 2);
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.wallColliders.push(new THREE.Box3(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, WALL_H, z1)));
    return mesh;
  }

  _wallWithDoor(mat, trimMat, x, z0, z1, width, rotation = 0) {
    // Compact helper for vertical partitions; the exact doorway position is centred.
    const mid = (z0 + z1) / 2;
    const gap = width;
    if (z1 - z0 > gap + 0.3) {
      this._wall(mat, x - WALL_T / 2, x + WALL_T / 2, z0, mid - gap / 2);
      this._wall(mat, x - WALL_T / 2, x + WALL_T / 2, mid + gap / 2, z1);
      this._interiorDoor(trimMat, x, mid, rotation);
    }
  }

  _doorWall(mat, trimMat, z, x, horizontal = true) {
    const xDoor = -4.4;
    const half = DOOR_W / 2;
    this._wall(mat, HOUSE.x0, xDoor - half, HOUSE.z0, HOUSE.z0 + WALL_T, 'south');
    this._wall(mat, xDoor + half, HOUSE.x1, HOUSE.z0, HOUSE.z0 + WALL_T, 'south');
    this._exteriorDoor(trimMat, xDoor, HOUSE.z0 + WALL_T / 2);
  }

  _exteriorDoor(mat, x, z) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, z);
    this.scene.add(pivot);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.55, 0.12), mat);
    slab.position.set(0.75, 1.275, 0);
    slab.castShadow = true; pivot.add(slab);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), this._material(0xb98b3f, 0.25, 0.8));
    knob.position.set(1.35, 1.2, -0.09); pivot.add(knob);
    this.doors.push({ pivot, isOpen: false, currentAngle: 0, targetAngle: 0, openAngle: -Math.PI / 2 });
    // Door opening is animated visually; the doorway itself remains passable.
  }

  _interiorDoor(mat, x, z, rotation) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, z);
    pivot.rotation.y = rotation;
    this.scene.add(pivot);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.45, 1.48), mat);
    slab.position.set(0, 1.225, 0.74);
    slab.castShadow = true; pivot.add(slab);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), this._material(0xb98b3f, 0.25, 0.8));
    knob.position.set(0.1, 1.18, 1.32); pivot.add(knob);
    this.doors.push({ pivot, isOpen: false, currentAngle: 0, targetAngle: 0, openAngle: Math.PI / 2 });
  }

  _roomLight(x, y, z, color) {
    const fixture = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.08, 20), this._material(0xd8cfc2, 0.6));
    fixture.position.set(x, y, z); fixture.castShadow = true; this.scene.add(fixture);
    const light = new THREE.PointLight(color, 0.65, 9);
    light.position.set(x, y - 0.15, z); this.scene.add(light);
    this.rooms.push({ light });
  }

  _window(x, z, rotation, width, height) {
    const frame = this._material(0x604431, 0.68);
    const glass = new THREE.MeshBasicMaterial({ color: 0x9cc9df, transparent: true, opacity: 0.42, side: THREE.DoubleSide });
    const group = new THREE.Group();
    group.position.set(x, 1.75, z); group.rotation.y = rotation;
    const pane = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.05), glass); group.add(pane);
    for (const sx of [-width / 2, width / 2]) {
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.1, height + 0.18, 0.12), frame); v.position.x = sx; group.add(v);
    }
    const h = new THREE.Mesh(new THREE.BoxGeometry(width + 0.18, 0.1, 0.12), frame); group.add(h);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.05, height, 0.13), frame); group.add(cross);
    this.scene.add(group);
  }

  _registerPlatform(mesh, min, max) {
    const box = new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max));
    box.userData = { isClimbable: true };
    this.platforms.push({ mesh, box });
    return box;
  }

  _box(mesh, x, y, z, sx, sy, sz, climbable = false) {
    mesh.position.set(x, y + sy / 2, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.scene.add(mesh);
    if (climbable) this._registerPlatform(mesh, [x - sx / 2, y, z - sz / 2], [x + sx / 2, y + sy, z + sz / 2]);
    return mesh;
  }

  _sofa(x, z, rot) {
    const wood = this._material(0x5b3e2c, 0.75);
    const fabric = this._material(0x55706a, 0.92);
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; this.scene.add(g);
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.42, 1.15), fabric); base.position.y = 0.48; base.castShadow = true; g.add(base);
    const back = new THREE.Mesh(new THREE.BoxGeometry(3.3, 1.1, 0.22), fabric); back.position.set(0, 1.05, -0.47); back.castShadow = true; g.add(back);
    for (const px of [-1.48, 1.48]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 1.1), fabric); arm.position.set(px, 0.82, 0); arm.castShadow = true; g.add(arm); }
    for (const px of [-1.15, 1.15]) for (const pz of [-0.38, 0.38]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.46, 0.12), wood); leg.position.set(px, 0.23, pz); g.add(leg); }
    this._registerPlatform(base, [x - 1.65, 0.69, z - 0.58], [x + 1.65, 0.9, z + 0.58]);
  }

  _coffeeTable(x, z) {
    const wood = this._material(0x68462e, 0.72);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.18, 1.2), wood);
    this._box(top, x, 0.52, z, 2.1, 0.18, 1.2, true);
    for (const [dx, dz] of [[-0.85, -0.42], [0.85, -0.42], [-0.85, 0.42], [0.85, 0.42]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.52, 0.1), wood); leg.position.set(x + dx, 0.26, z + dz); leg.castShadow = true; this.scene.add(leg);
    }
  }

  _rug(x, z, sx, sz) {
    const mat = this._material(0xb8a48d, 0.98);
    const rug = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.035, sz), mat); rug.position.set(x, 0.018, z); rug.receiveShadow = true; this.scene.add(rug);
  }

  _tvUnit(x, z) {
    const wood = this._material(0x4f392c, 0.75);
    const unit = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.62, 0.55), wood); this._box(unit, x, 0, z, 3, 0.62, 0.55, false);
    const screenMat = new THREE.MeshStandardMaterial({ color: 0x10161b, roughness: 0.25, metalness: 0.2 });
    const screen = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.35, 0.08), screenMat); screen.position.set(x, 1.25, z + 0.02); screen.castShadow = true; this.scene.add(screen);
  }

  _bed(x, z, rot) {
    const wood = this._material(0x5e412d, 0.72);
    const fabric = this._material(0xe2ddd0, 0.96);
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; this.scene.add(g);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.34, 4.5), wood); frame.position.y = 0.32; frame.castShadow = true; g.add(frame);
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.42, 4.25), fabric); mattress.position.y = 0.62; mattress.castShadow = true; g.add(mattress);
    const head = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.45, 0.18), wood); head.position.set(0, 1.02, -2.08); head.castShadow = true; g.add(head);
    this._registerPlatform(mattress, [x - 1.32, 0.83, z - 2.13], [x + 1.32, 1.04, z + 2.13]);
  }

  _bedside(x, z) {
    const m = this._material(0x60432f, 0.75);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.68, 0.75), m); this._box(t, x, 0, z, 0.75, 0.68, 0.75, true);
    const lamp = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.32, 12), this._material(0xd6c39e, 0.8)); lamp.position.set(x, 1.05, z); this.scene.add(lamp);
  }

  _dresser(x, z, rot) {
    const m = this._material(0x553b2b, 0.72);
    const d = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.15, 0.55), m); d.position.set(x, 0.575, z); d.rotation.y = rot; d.castShadow = true; this.scene.add(d);
  }

  _wardrobe(x, z) {
    const m = this._material(0x4b3428, 0.72);
    const w = new THREE.Mesh(new THREE.BoxGeometry(1.45, 2.5, 0.72), m); this._box(w, x, 0, z, 1.45, 2.5, 0.72, false);
    for (const dx of [-0.32, 0.32]) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), this._material(0xb18b53, 0.3, 0.5)); h.position.set(x + dx, 1.25, z + 0.39); this.scene.add(h); }
  }

  _kitchenCabinet(x, z) {
    const m = this._material(0x9a6a43, 0.72);
    const top = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.15, 0.72), this._material(0xbbb3a4, 0.55)); this._box(top, x, 1.0, z, 6.2, 0.15, 0.72, false);
    const base = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1.0, 0.65), m); this._box(base, x, 0, z, 6.2, 1, 0.65, false);
    for (let i = 0; i < 5; i++) { const line = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.68, 0.02), this._material(0x3d2b22, 0.8)); line.position.set(x - 2.2 + i * 1.1, 0.5, z + 0.34); this.scene.add(line); }
  }

  _counter(x, z, width) {
    const m = this._material(0x88715c, 0.62);
    const top = new THREE.Mesh(new THREE.BoxGeometry(width, 0.13, 0.72), m); this._box(top, x, 1.02, z, width, 0.13, 0.72, false);
  }

  _fridge(x, z) {
    const m = this._material(0xb8b9b5, 0.32, 0.18);
    const f = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.25, 1.0), m); this._box(f, x, 0, z, 1.25, 2.25, 1, false);
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.025, 0.015), this._material(0x555a58, 0.4, 0.4)); line.position.set(x, 1.12, z + 0.51); this.scene.add(line);
  }

  _diningTable(x, z) {
    const wood = this._material(0x69472f, 0.72);
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.16, 1.5), wood); this._box(top, x, 0.74, z, 3, 0.16, 1.5, true);
    for (const [dx, dz] of [[-1.25, -0.55], [1.25, -0.55], [-1.25, 0.55], [1.25, 0.55]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 0.12), wood); l.position.set(x + dx, 0.375, z + dz); l.castShadow = true; this.scene.add(l); }
  }

  _chair(x, z) {
    const m = this._material(0x6d4b34, 0.75);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.16, 0.72), m); this._box(seat, x, 0.48, z, 0.72, 0.16, 0.72, true);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.12), m); back.position.set(x, 1.0, z - 0.3); back.castShadow = true; this.scene.add(back);
  }

  _bench(x, z, width, height) {
    const m = this._material(0x705037, 0.72);
    const top = new THREE.Mesh(new THREE.BoxGeometry(width, 0.18, 0.65), m); this._box(top, x, height - 0.18, z, width, 0.18, 0.65, true);
  }

  _vanity(x, z) {
    const m = this._material(0x927354, 0.75);
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.72, 0.62), m); this._box(base, x, 0, z, 2.1, 0.72, 0.62, false);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.14, 0.72), this._material(0xd7d0c2, 0.5)); this._box(top, x, 0.72, z, 2.25, 0.14, 0.72, true);
  }

  _toilet(x, z) {
    const porcelain = this._material(0xe8e5dc, 0.35);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.5, 0.45, 20), porcelain); bowl.position.set(x, 0.225, z); bowl.castShadow = true; this.scene.add(bowl);
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.25), porcelain); tank.position.set(x, 0.7, z - 0.27); tank.castShadow = true; this.scene.add(tank);
  }

  _bathtub(x, z) {
    const porcelain = this._material(0xe6e0d4, 0.38);
    const tub = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.62, 0.95), porcelain); tub.position.set(x, 0.31, z); tub.castShadow = true; this.scene.add(tub);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.62), this._material(0xb9c6c9, 0.25)); inner.position.set(x, 0.63, z); this.scene.add(inner);
  }

  _crawlUnderFurniture(x, z, width, depth, ceilingY) {
    // A low clearance volume under the bed. While crawling it is passable;
    // while standing it acts as a ceiling. No extra geometry is needed.
    this.crawlObstacles.push(new THREE.Box3(
      new THREE.Vector3(x - width / 2, ceilingY, z - depth / 2),
      new THREE.Vector3(x + width / 2, ceilingY + 0.12, z + depth / 2)
    ));
  }

  _plant(x, z, scale) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.45, 14), this._material(0x8c5d42, 0.85)); pot.position.set(x, 0.225, z); pot.castShadow = true; this.scene.add(pot);
    for (let i = 0; i < 6; i++) { const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), this._material(0x456c3c, 0.9)); leaf.position.set(x + Math.sin(i * 1.8) * 0.3, 0.7 + i * 0.05, z + Math.cos(i * 1.8) * 0.3); leaf.scale.set(0.75, 1.25, 0.75); leaf.castShadow = true; this.scene.add(leaf); }
  }

  _tree(x, z, scale) {
    const bark = this._material(0x513a29, 0.98);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * scale, 0.48 * scale, 4.6 * scale, 9), bark);
    trunk.position.set(x, 2.3 * scale, z); trunk.castShadow = true; this.scene.add(trunk);
    const leaf = this._material(0x2f6334, 0.92);
    for (let i = 0; i < 8; i++) {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry((1.1 + (i % 3) * 0.28) * scale, 1), leaf);
      const a = i * Math.PI * 2 / 8;
      crown.position.set(x + Math.cos(a) * 0.9 * scale, (4.1 + (i % 2) * 0.7) * scale, z + Math.sin(a) * 0.9 * scale);
      crown.castShadow = true; crown.receiveShadow = true; this.scene.add(crown);
    }
  }

  _fencePost(mat, x, z, rotation) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.2, 0.14), mat); post.position.set(x, 0.6, z); post.rotation.y = rotation; post.castShadow = true; this.scene.add(post);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(rotation ? 2.5 : 2.5, 0.12, 0.12), mat); rail.position.set(x, 0.9, z); rail.rotation.y = rotation; rail.castShadow = true; this.scene.add(rail);
  }

  getColliders() {
    return [...this.wallColliders, ...this.platforms.map(p => p.box)];
  }

  getGroundHeight(position, radius, previousY = position.y, velocityY = 0) {
    let ground = 0;
    if (velocityY <= 0) {
      for (const { box } of this.platforms) {
        const overlapX = position.x + radius * 0.75 > box.min.x && position.x - radius * 0.75 < box.max.x;
        const overlapZ = position.z + radius * 0.75 > box.min.z && position.z - radius * 0.75 < box.max.z;
        if (!overlapX || !overlapZ) continue;
        const crossed = previousY >= box.max.y - 0.12 && position.y <= box.max.y + 0.12;
        const standing = Math.abs(previousY - box.max.y) <= 0.12 && position.y <= box.max.y + 0.12;
        if (crossed || standing) ground = Math.max(ground, box.max.y);
      }
    }
    return ground;
  }

  isBlockedByLowCeiling(position, radius, playerHeight) {
    for (const box of this.crawlObstacles) {
      const overlapX = position.x + radius > box.min.x && position.x - radius < box.max.x;
      const overlapZ = position.z + radius > box.min.z && position.z - radius < box.max.z;
      if (overlapX && overlapZ && playerHeight > box.min.y) return true;
    }
    return false;
  }

  _nearestDoor(playerPos, range) {
    let nearest = null, nearestDist = Infinity;
    for (const door of this.doors) {
      const dist = playerPos.distanceTo(door.pivot.position);
      if (dist < range && dist < nearestDist) { nearest = door; nearestDist = dist; }
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
