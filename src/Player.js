import * as THREE from 'three';

/** Detailed procedural third-person character: hood, balaclava, layered clothing and shoes. */
export class Player {
  constructor() {
    const jacket = new THREE.MeshStandardMaterial({ color: 0x20252a, roughness: 0.82 });
    const jacket2 = new THREE.MeshStandardMaterial({ color: 0x30363c, roughness: 0.78 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x171a1d, roughness: 0.88 });
    const boot = new THREE.MeshStandardMaterial({ color: 0x090a0b, roughness: 0.48, metalness: 0.05 });
    const glove = new THREE.MeshStandardMaterial({ color: 0x101214, roughness: 0.7 });
    const mask = new THREE.MeshStandardMaterial({ color: 0x090a0b, roughness: 0.92 });
    const skin = new THREE.MeshStandardMaterial({ color: 0x7c5138, roughness: 0.86 });
    const eye = new THREE.MeshStandardMaterial({ color: 0x8cc6ff, roughness: 0.25, emissive: 0x0d2234, emissiveIntensity: 0.25 });
    const belt = new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.5 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x7e8586, roughness: 0.35, metalness: 0.65 });

    this.root = new THREE.Group();
    this.root.name = 'RealisticRobberPlayer';

    // Legs and shoes are separate for a natural walking silhouette.
    this.leftLeg = this._leg(pants, boot, -0.16);
    this.rightLeg = this._leg(pants, boot, 0.16);
    this.root.add(this.leftLeg.group, this.rightLeg.group);

    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.34, 0.36), pants);
    pelvis.position.y = 1.0;
    pelvis.castShadow = true;
    this.root.add(pelvis);

    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.82, 0.42), jacket);
    this.torso.position.y = 1.48;
    this.torso.castShadow = true;
    this.root.add(this.torso);

    // Jacket hem, zipper and belt add visual depth without external assets.
    this._addBox(this.root, 0, 1.08, 0, 0.76, 0.12, 0.45, jacket2);
    this._addBox(this.root, 0, 1.48, -0.216, 0.045, 0.65, 0.025, metal);
    this._addBox(this.root, 0, 1.08, 0, 0.74, 0.08, 0.43, belt);

    this.leftArm = this._arm(jacket2, glove, -0.44);
    this.rightArm = this._arm(jacket2, glove, 0.44);
    this.torso.add(this.leftArm.shoulder, this.rightArm.shoulder);

    // Hood around the neck.
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.105, 10, 20), jacket);
    hood.rotation.x = Math.PI / 2;
    hood.position.y = 1.94;
    hood.castShadow = true;
    this.root.add(hood);

    this.headJoint = new THREE.Group();
    this.headJoint.position.set(0, 1.95, 0);
    this.root.add(this.headJoint);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.255, 20, 16), mask);
    head.scale.set(0.92, 1.08, 0.92);
    head.position.y = 0.28;
    head.castShadow = true;
    this.headJoint.add(head);

    // Balaclava opening: skin area with realistic eye placement and brow shadow.
    const opening = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 12), skin);
    opening.scale.set(0.95, 0.63, 0.38);
    opening.position.set(0, 0.27, 0.22);
    opening.castShadow = true;
    this.headJoint.add(opening);
    for (const x of [-0.082, 0.082]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), eye);
      e.scale.set(1.0, 0.58, 0.5);
      e.position.set(x, 0.34, 0.365);
      this.headJoint.add(e);
    }
    for (const x of [-0.09, 0.09]) {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.026, 0.035), mask);
      brow.position.set(x, 0.42, 0.36);
      brow.rotation.z = x < 0 ? 0.08 : -0.08;
      this.headJoint.add(brow);
    }

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.22, 14), mask);
    neck.position.y = 0.03;
    this.headJoint.add(neck);

    // Subtle clothing seams.
    this._addBox(this.torso, -0.32, 0, 0, 0.018, 0.65, 0.43, jacket2);
    this._addBox(this.torso, 0.32, 0, 0, 0.018, 0.65, 0.43, jacket2);

    this.walkTime = 0;
    this.doorInteraction = null;
    this.crawling = false;
  }

  _addBox(parent, x, y, z, w, h, d, material) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  _leg(pants, boot, x) {
    const group = new THREE.Group();
    group.position.set(x, 0.94, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.52, 0.25), pants);
    upper.position.y = -0.27;
    upper.castShadow = true;
    group.add(upper);
    const knee = new THREE.Group();
    knee.position.y = -0.53;
    group.add(knee);
    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.54, 0.21), pants);
    lower.position.y = -0.27;
    lower.castShadow = true;
    knee.add(lower);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.42), boot);
    shoe.position.set(0, -0.59, 0.08);
    shoe.castShadow = true;
    knee.add(shoe);
    return { group, knee };
  }

  _arm(body, glove, x) {
    const shoulder = new THREE.Group();
    shoulder.position.set(x, 0.30, 0);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.13, 0.43, 10), body);
    upper.position.y = -0.22;
    upper.castShadow = true;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.45;
    shoulder.add(elbow);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.105, 0.43, 10), body);
    lower.position.y = -0.22;
    lower.castShadow = true;
    elbow.add(lower);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 9), glove);
    hand.scale.set(0.82, 1.05, 0.82);
    hand.position.y = -0.49;
    hand.castShadow = true;
    elbow.add(hand);
    // Thumb block for a more human hand silhouette.
    const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), glove);
    thumb.position.set(x < 0 ? 0.07 : -0.07, -0.46, 0.05);
    elbow.add(thumb);
    return { shoulder, elbow };
  }

  get object3D() { return this.root; }
  getPosition() { return this.root.position; }
  setVisible(v) { this.root.visible = v; }

  update(delta, state) {
    this.crawling = !!state.crawling;
    if (state.moving) this.walkTime += delta * 7 * Math.max(0.7, state.speed);
    const swing = state.moving ? Math.sin(this.walkTime) * 0.55 : 0;
    const counter = -swing;
    const airBend = !state.grounded ? 0.4 : 0;

    this.leftArm.shoulder.rotation.x = counter * 0.65;
    this.rightArm.shoulder.rotation.x = swing * 0.65;
    this.leftLeg.group.rotation.x = swing;
    this.rightLeg.group.rotation.x = counter;
    this.leftLeg.knee.rotation.x = Math.max(0, -swing) * 0.55 + airBend;
    this.rightLeg.knee.rotation.x = Math.max(0, -counter) * 0.55 + airBend;

    if (this.crawling) {
      this.root.scale.y = THREE.MathUtils.lerp(this.root.scale.y, 0.58, Math.min(1, delta * 10));
      this.torso.rotation.x = THREE.MathUtils.lerp(this.torso.rotation.x, -0.5, Math.min(1, delta * 8));
      this.headJoint.rotation.x = THREE.MathUtils.lerp(this.headJoint.rotation.x, 0.35, Math.min(1, delta * 8));
      this.leftArm.shoulder.rotation.x = -1.05;
      this.rightArm.shoulder.rotation.x = -1.05;
    } else {
      this.root.scale.y = THREE.MathUtils.lerp(this.root.scale.y, 1, Math.min(1, delta * 10));
      this.torso.rotation.x = THREE.MathUtils.lerp(this.torso.rotation.x, 0, Math.min(1, delta * 8));
      this.headJoint.rotation.x = THREE.MathUtils.lerp(this.headJoint.rotation.x, 0, Math.min(1, delta * 8));
    }

    if (this.doorInteraction) {
      const { target, progress } = this.doorInteraction;
      const local = this.root.worldToLocal(target.clone());
      const reach = Math.sin(progress * Math.PI);
      const armAngle = THREE.MathUtils.clamp(-Math.atan2(local.z, Math.max(0.3, local.y - 1.0)), -1.35, 1.35);
      this.rightArm.shoulder.rotation.x = THREE.MathUtils.lerp(this.rightArm.shoulder.rotation.x, armAngle, reach);
      this.rightArm.elbow.rotation.x = THREE.MathUtils.lerp(0, -0.55, reach);
    } else {
      this.rightArm.elbow.rotation.x *= 0.8;
    }
  }

  startDoorInteraction(pos) { this.doorInteraction = { target: pos.clone(), progress: 0 }; }
  updateDoorInteraction(delta) {
    if (!this.doorInteraction) return;
    this.doorInteraction.progress = Math.min(1, this.doorInteraction.progress + delta * 3.2);
  }
  stopDoorInteraction() { this.doorInteraction = null; this.rightArm.elbow.rotation.x = 0; }

  lookAt(targetWorldPos) {
    const local = this.headJoint.worldToLocal(targetWorldPos.clone());
    const targetYaw = Math.atan2(local.x, local.z);
    this.headJoint.rotation.y += (targetYaw - this.headJoint.rotation.y) * 0.15;
  }
}
