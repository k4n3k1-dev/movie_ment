import * as THREE from 'three';

/** Simple third-person humanoid robber avatar with articulated limbs. */
export class Player {
  constructor() {
    const clothesMat = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.72 });
    const jacketMat = new THREE.MeshStandardMaterial({ color: 0x22252b, roughness: 0.68 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x090a0d, roughness: 0.82 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.55 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x7f4f32, roughness: 0.8 });
    const maskMat = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.9 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x7db7ff, roughness: 0.35, metalness: 0.1 });

    this.root = new THREE.Group();
    this.root.name = 'RobberPlayerRoot';

    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.72, 0.32), jacketMat);
    this.torso.position.y = 1.12;
    this.torso.castShadow = true;
    this.root.add(this.torso);

    // Small hood/collar for the balaclava look.
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.14, 12), clothesMat);
    collar.position.y = 1.51;
    collar.castShadow = true;
    this.root.add(collar);

    this.headJoint = new THREE.Group();
    this.headJoint.position.set(0, 0.48, 0);
    this.torso.add(this.headJoint);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), maskMat);
    head.position.y = 0.19;
    head.castShadow = true;
    this.headJoint.add(head);

    // Balaclava face opening + eyes.
    const faceOpening = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 10), skinMat);
    faceOpening.scale.set(1, 0.62, 0.5);
    faceOpening.position.set(0, 0.16, 0.145);
    this.headJoint.add(faceOpening);
    for (const x of [-0.055, 0.055]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), eyeMat);
      eye.position.set(x, 0.205, 0.255);
      this.headJoint.add(eye);
    }

    // Knit cap / beanie.
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.21, 0.12, 16), clothesMat);
    hat.position.y = 0.405;
    hat.castShadow = true;
    this.headJoint.add(hat);
    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.195, 0.025, 6, 16), clothesMat);
    brim.rotation.x = Math.PI / 2;
    brim.position.y = 0.35;
    this.headJoint.add(brim);

    this.leftArm = this._buildLimb(jacketMat, gloveMat, 0.35, 0.55, false);
    this.leftArm.shoulder.position.set(-0.33, 0.31, 0);
    this.torso.add(this.leftArm.shoulder);
    this.rightArm = this._buildLimb(jacketMat, gloveMat, 0.35, 0.55, false);
    this.rightArm.shoulder.position.set(0.33, 0.31, 0);
    this.torso.add(this.rightArm.shoulder);

    this.leftLeg = this._buildLimb(clothesMat, shoeMat, 0.4, 0.6, true);
    this.leftLeg.shoulder.position.set(-0.14, 0.76, 0);
    this.root.add(this.leftLeg.shoulder);
    this.rightLeg = this._buildLimb(clothesMat, shoeMat, 0.4, 0.6, true);
    this.rightLeg.shoulder.position.set(0.14, 0.76, 0);
    this.root.add(this.rightLeg.shoulder);

    this.walkTime = 0;
    this.doorInteraction = null;
    this.crawling = false;
  }

  _buildLimb(bodyMat, endMat, upperLen, lowerLen, isLeg) {
    const shoulder = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.14, upperLen, 0.14), bodyMat);
    upper.position.y = -upperLen / 2;
    upper.castShadow = true;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -upperLen;
    shoulder.add(elbow);
    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.12, lowerLen, 0.12), bodyMat);
    lower.position.y = -lowerLen / 2;
    lower.castShadow = true;
    elbow.add(lower);

    const end = new THREE.Group();
    end.position.y = -lowerLen;
    elbow.add(end);
    const endMesh = new THREE.Mesh(
      isLeg ? new THREE.BoxGeometry(0.17, 0.09, 0.25) : new THREE.SphereGeometry(0.08, 8, 8),
      endMat
    );
    endMesh.castShadow = true;
    end.add(endMesh);
    return { shoulder, elbow, end };
  }

  get object3D() { return this.root; }
  getPosition() { return this.root.position; }
  setVisible(visible) { this.root.visible = visible; }

  update(delta, moveState) {
    this.crawling = !!moveState.crawling;
    if (moveState.moving) this.walkTime += delta * 6 * moveState.speed;

    const swing = Math.sin(this.walkTime) * (moveState.moving ? 0.6 : 0);
    const counterSwing = Math.sin(this.walkTime + Math.PI) * (moveState.moving ? 0.6 : 0);
    const airborne = !moveState.grounded;
    const jumpBend = airborne ? THREE.MathUtils.clamp(0.35 + Math.max(0, -moveState.verticalVelocity) * 0.035, 0.35, 0.95) : 0;

    this.leftArm.shoulder.rotation.x = counterSwing * 0.5;
    this.rightArm.shoulder.rotation.x = swing * 0.5;
    this.leftLeg.shoulder.rotation.x = swing;
    this.rightLeg.shoulder.rotation.x = counterSwing;
    this.leftLeg.elbow.rotation.x = Math.max(0, -swing) * 0.8 + jumpBend;
    this.rightLeg.elbow.rotation.x = Math.max(0, -counterSwing) * 0.8 + jumpBend;

    if (this.crawling) {
      // Low stealth/crawl silhouette: crouch the body and put hands forward.
      this.root.scale.y = THREE.MathUtils.lerp(this.root.scale.y, 0.58, Math.min(1, 10 * delta));
      this.torso.rotation.x = THREE.MathUtils.lerp(this.torso.rotation.x, -0.45, Math.min(1, 8 * delta));
      this.headJoint.rotation.x = THREE.MathUtils.lerp(this.headJoint.rotation.x, 0.35, Math.min(1, 8 * delta));
      this.leftArm.shoulder.rotation.x = -1.0;
      this.rightArm.shoulder.rotation.x = -1.0;
      this.leftLeg.shoulder.rotation.x = 0.8;
      this.rightLeg.shoulder.rotation.x = 0.8;
    } else {
      this.root.scale.y = THREE.MathUtils.lerp(this.root.scale.y, 1, Math.min(1, 10 * delta));
      this.torso.rotation.x = THREE.MathUtils.lerp(this.torso.rotation.x, 0, Math.min(1, 8 * delta));
      this.headJoint.rotation.x = THREE.MathUtils.lerp(this.headJoint.rotation.x, 0, Math.min(1, 8 * delta));
    }

    if (this.doorInteraction) {
      const { target, progress } = this.doorInteraction;
      const localTarget = this.root.worldToLocal(target.clone());
      const reach = Math.sin(progress * Math.PI);
      const armAngle = THREE.MathUtils.clamp(-Math.atan2(localTarget.z, Math.max(0.35, localTarget.y - 1.0)) * 0.9, -1.35, 1.35);
      this.rightArm.shoulder.rotation.x = THREE.MathUtils.lerp(this.rightArm.shoulder.rotation.x, armAngle, reach);
      this.rightArm.shoulder.rotation.z = THREE.MathUtils.lerp(this.rightArm.shoulder.rotation.z, localTarget.x > 0 ? -0.25 : 0.25, reach);
      this.rightArm.elbow.rotation.x = THREE.MathUtils.lerp(0, -0.55, reach);
    } else {
      this.rightArm.shoulder.rotation.z = 0;
      this.rightArm.elbow.rotation.x = 0;
    }
  }

  startDoorInteraction(doorWorldPos) { this.doorInteraction = { target: doorWorldPos.clone(), progress: 0 }; }
  updateDoorInteraction(delta) {
    if (!this.doorInteraction) return;
    this.doorInteraction.progress = Math.min(1, this.doorInteraction.progress + delta * 3.5);
    if (this.doorInteraction.progress >= 1) this.doorInteraction.hold = true;
  }
  stopDoorInteraction() { this.doorInteraction = null; this.rightArm.shoulder.rotation.z = 0; }

  lookAt(targetWorldPos) {
    const local = this.headJoint.worldToLocal(targetWorldPos.clone());
    const targetYaw = Math.atan2(local.x, local.z);
    this.headJoint.rotation.y += (targetYaw - this.headJoint.rotation.y) * 0.15;
  }
}
