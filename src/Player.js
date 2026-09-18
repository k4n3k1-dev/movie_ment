import * as THREE from 'three';

/** Detailed, fully clothed third-person robber avatar made only from Three.js primitives. */
export class Player {
  constructor() {
    const jacketMat = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.82 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x0d1014, roughness: 0.9 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 0.42, metalness: 0.08 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.68 });
    const maskMat = new THREE.MeshStandardMaterial({ color: 0x07090c, roughness: 0.92 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x8d5a3c, roughness: 0.72 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x94b9ce, roughness: 0.25 });
    const soleMat = new THREE.MeshStandardMaterial({ color: 0x17191d, roughness: 0.72 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x777d83, roughness: 0.32, metalness: 0.75 });

    this.root = new THREE.Group();
    this.root.name = 'RobberPlayerRoot';

    // Layered torso: jacket body + collar + shoulder seams + belt.
    this.torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.29, 0.48, 6, 12), jacketMat);
    this.torso.scale.z = 0.62;
    this.torso.position.y = 1.14;
    this.torso.castShadow = true;
    this.root.add(this.torso);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 8, 18), maskMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 1.52;
    collar.scale.z = 0.8;
    this.root.add(collar);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.075, 0.28), pantsMat);
    belt.position.set(0, 0.83, 0);
    belt.castShadow = true;
    this.root.add(belt);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.035), metalMat);
    buckle.position.set(0, 0.83, 0.145);
    this.root.add(buckle);

    this.headJoint = new THREE.Group();
    this.headJoint.position.set(0, 1.58, 0);
    this.root.add(this.headJoint);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.205, 24, 16), maskMat);
    head.scale.set(0.92, 1.03, 0.88);
    head.castShadow = true;
    this.headJoint.add(head);

    // Balaclava face opening, eye openings and a subtle nose/mouth contour.
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.125, 20, 14), skinMat);
    face.scale.set(1.0, 0.72, 0.45);
    face.position.set(0, -0.005, 0.168);
    this.headJoint.add(face);
    const maskLower = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.075, 0.035), maskMat);
    maskLower.position.set(0, -0.095, 0.195);
    this.headJoint.add(maskLower);
    for (const x of [-0.061, 0.061]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.021, 12, 8), eyeMat);
      eye.scale.z = 0.45;
      eye.position.set(x, 0.045, 0.205);
      this.headJoint.add(eye);
    }

    // Knit beanie with cuff.
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.215, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.54), jacketMat);
    hat.position.y = 0.18;
    hat.castShadow = true;
    this.headJoint.add(hat);
    const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.075, 20), pantsMat);
    hatBand.position.y = 0.12;
    hatBand.castShadow = true;
    this.headJoint.add(hatBand);

    this.leftArm = this._buildArm(jacketMat, gloveMat, true);
    this.leftArm.shoulder.position.set(-0.34, 1.42, 0);
    this.root.add(this.leftArm.shoulder);
    this.rightArm = this._buildArm(jacketMat, gloveMat, false);
    this.rightArm.shoulder.position.set(0.34, 1.42, 0);
    this.root.add(this.rightArm.shoulder);

    this.leftLeg = this._buildLeg(pantsMat, bootMat, soleMat, true);
    this.leftLeg.hip.position.set(-0.14, 0.82, 0);
    this.root.add(this.leftLeg.hip);
    this.rightLeg = this._buildLeg(pantsMat, bootMat, soleMat, false);
    this.rightLeg.hip.position.set(0.14, 0.82, 0);
    this.root.add(this.rightLeg.hip);

    this.walkTime = 0;
    this.doorInteraction = null;
    this.crawling = false;
  }

  _buildArm(jacketMat, gloveMat) {
    const shoulder = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.30, 5, 10), jacketMat);
    upper.position.y = -0.19;
    upper.castShadow = true;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -0.39;
    shoulder.add(elbow);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.30, 5, 10), jacketMat);
    fore.position.y = -0.18;
    fore.castShadow = true;
    elbow.add(fore);

    const hand = new THREE.Group();
    hand.position.y = -0.39;
    elbow.add(hand);
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 8), gloveMat);
    palm.scale.set(0.9, 1.0, 0.72);
    palm.castShadow = true;
    hand.add(palm);
    for (let i = -1; i <= 1; i++) {
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.075, 4, 7), gloveMat);
      finger.position.set(i * 0.025, -0.08, 0.012);
      finger.rotation.x = 0.2;
      hand.add(finger);
    }
    return { shoulder, elbow, hand };
  }

  _buildLeg(pantsMat, bootMat, soleMat) {
    const hip = new THREE.Group();
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.34, 5, 10), pantsMat);
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -0.44;
    hip.add(knee);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.078, 0.35, 5, 10), pantsMat);
    shin.position.y = -0.21;
    shin.castShadow = true;
    knee.add(shin);

    const foot = new THREE.Group();
    foot.position.y = -0.43;
    knee.add(foot);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.15, 0.34), bootMat);
    boot.position.set(0, 0.0, 0.055);
    boot.castShadow = true;
    foot.add(boot);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.035, 0.36), soleMat);
    sole.position.set(0, -0.08, 0.055);
    foot.add(sole);
    return { hip, knee, foot };
  }

  get object3D() { return this.root; }
  getPosition() { return this.root.position; }
  setVisible(visible) { this.root.visible = visible; }

  update(delta, moveState) {
    this.crawling = !!moveState.crawling;
    if (moveState.moving) this.walkTime += delta * 7 * moveState.speed;

    const swing = Math.sin(this.walkTime) * (moveState.moving ? 0.58 : 0);
    const counter = -swing;
    const airborne = !moveState.grounded;
    const jumpBend = airborne ? THREE.MathUtils.clamp(0.48 + Math.max(0, -moveState.verticalVelocity) * 0.04, 0.48, 1.15) : 0;

    this.leftArm.shoulder.rotation.x = counter * 0.45;
    this.rightArm.shoulder.rotation.x = swing * 0.45;
    this.leftLeg.hip.rotation.x = swing;
    this.rightLeg.hip.rotation.x = counter;
    this.leftLeg.knee.rotation.x = jumpBend + Math.max(0, -swing) * 0.7;
    this.rightLeg.knee.rotation.x = jumpBend + Math.max(0, -counter) * 0.7;

    if (this.crawling) {
      this.root.scale.y = THREE.MathUtils.lerp(this.root.scale.y, 0.58, Math.min(1, 10 * delta));
      this.torso.rotation.x = THREE.MathUtils.lerp(this.torso.rotation.x, -0.48, Math.min(1, 8 * delta));
      this.headJoint.rotation.x = THREE.MathUtils.lerp(this.headJoint.rotation.x, 0.38, Math.min(1, 8 * delta));
      this.leftArm.shoulder.rotation.x = -1.0;
      this.rightArm.shoulder.rotation.x = -1.0;
      this.leftArm.elbow.rotation.x = -0.45;
      this.rightArm.elbow.rotation.x = -0.45;
      this.leftLeg.hip.rotation.x = 0.8;
      this.rightLeg.hip.rotation.x = 0.8;
      this.leftLeg.knee.rotation.x = 1.05;
      this.rightLeg.knee.rotation.x = 1.05;
    } else {
      this.root.scale.y = THREE.MathUtils.lerp(this.root.scale.y, 1, Math.min(1, 10 * delta));
      this.torso.rotation.x = THREE.MathUtils.lerp(this.torso.rotation.x, 0, Math.min(1, 8 * delta));
      this.headJoint.rotation.x = THREE.MathUtils.lerp(this.headJoint.rotation.x, 0, Math.min(1, 8 * delta));
    }

    if (this.doorInteraction) {
      const { target, progress } = this.doorInteraction;
      const local = this.root.worldToLocal(target.clone());
      const reach = Math.sin(progress * Math.PI);
      const armAngle = THREE.MathUtils.clamp(-Math.atan2(local.z, Math.max(0.35, local.y - 1.0)) * 0.9, -1.45, 1.45);
      this.rightArm.shoulder.rotation.x = THREE.MathUtils.lerp(this.rightArm.shoulder.rotation.x, armAngle, reach);
      this.rightArm.shoulder.rotation.z = THREE.MathUtils.lerp(this.rightArm.shoulder.rotation.z, local.x > 0 ? -0.28 : 0.28, reach);
      this.rightArm.elbow.rotation.x = THREE.MathUtils.lerp(this.rightArm.elbow.rotation.x, -0.62, reach);
      this.rightArm.hand.rotation.x = THREE.MathUtils.lerp(this.rightArm.hand.rotation.x, -0.35, reach);
    } else {
      this.rightArm.shoulder.rotation.z = THREE.MathUtils.lerp(this.rightArm.shoulder.rotation.z, 0, 0.2);
      this.rightArm.elbow.rotation.x = THREE.MathUtils.lerp(this.rightArm.elbow.rotation.x, 0, 0.2);
      this.rightArm.hand.rotation.x = THREE.MathUtils.lerp(this.rightArm.hand.rotation.x, 0, 0.2);
    }
  }

  startDoorInteraction(doorWorldPos) { this.doorInteraction = { target: doorWorldPos.clone(), progress: 0 }; }
  updateDoorInteraction(delta) {
    if (!this.doorInteraction) return;
    this.doorInteraction.progress = Math.min(1, this.doorInteraction.progress + delta * 3.5);
  }
  stopDoorInteraction() { this.doorInteraction = null; }

  lookAt(targetWorldPos) {
    const local = this.headJoint.worldToLocal(targetWorldPos.clone());
    const targetYaw = Math.atan2(local.x, local.z);
    this.headJoint.rotation.y += (targetYaw - this.headJoint.rotation.y) * 0.15;
  }
}
