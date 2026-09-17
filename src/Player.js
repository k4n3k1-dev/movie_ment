import * as THREE from 'three';

/**
 * Hierarchical humanoid placeholder avatar.
 *
 * Scenegraph:
 *   root (Group)                    <- PlayerController moves/rotates THIS
 *     torso (Mesh)
 *       headJoint (Group)           <- can turn independently of the body
 *         head (Mesh)
 *       leftArm.shoulder (Group)    <- shoulder joint, child of torso
 *         upper (Mesh)
 *         leftArm.elbow (Group)     <- elbow joint, child of upper arm's end
 *           lower (Mesh)
 *           leftArm.end (Group)     <- hand, child of forearm's end
 *             handMesh
 *       rightArm.* (mirrored)
 *     leftLeg.shoulder (Group)      <- hip joint, child of ROOT (not torso)
 *       upper / leftLeg.elbow (knee) / leftLeg.end (foot)
 *     rightLeg.* (mirrored)
 *
 * Swap the primitive meshes for a rigged GLB later without touching
 * PlayerController or the getPosition() contract below.
 */
export class Player {
  constructor() {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.6 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd8a97a, roughness: 0.7 });

    this.root = new THREE.Group();
    this.root.name = 'PlayerRoot';

    // --- Torso ---
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), bodyMat);
    this.torso.position.y = 1.1;
    this.torso.castShadow = true;
    this.root.add(this.torso);

    // --- Head: child of torso, turns independently ---
    this.headJoint = new THREE.Group();
    this.headJoint.position.set(0, 0.45, 0);
    this.torso.add(this.headJoint);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), skinMat);
    head.position.y = 0.18;
    head.castShadow = true;
    this.headJoint.add(head);

    // --- Arms: shoulder -> elbow -> hand chain, children of torso ---
    this.leftArm = this._buildLimb(bodyMat, skinMat, 0.35, 0.55, false);
    this.leftArm.shoulder.position.set(-0.32, 0.3, 0);
    this.torso.add(this.leftArm.shoulder);

    this.rightArm = this._buildLimb(bodyMat, skinMat, 0.35, 0.55, false);
    this.rightArm.shoulder.position.set(0.32, 0.3, 0);
    this.torso.add(this.rightArm.shoulder);

    // --- Legs: hip -> knee -> foot chain, children of ROOT ---
    this.leftLeg = this._buildLimb(bodyMat, skinMat, 0.4, 0.6, true);
    this.leftLeg.shoulder.position.set(-0.14, 0.75, 0);
    this.root.add(this.leftLeg.shoulder);

    this.rightLeg = this._buildLimb(bodyMat, skinMat, 0.4, 0.6, true);
    this.rightLeg.shoulder.position.set(0.14, 0.75, 0);
    this.root.add(this.rightLeg.shoulder);

    this.walkTime = 0;
    this.doorInteraction = null;
  }

  _buildLimb(bodyMat, skinMat, upperLen, lowerLen, isLeg) {
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
      isLeg ? new THREE.BoxGeometry(0.14, 0.08, 0.22) : new THREE.SphereGeometry(0.08, 8, 8),
      skinMat
    );
    endMesh.castShadow = true;
    end.add(endMesh);

    return { shoulder, elbow, end };
  }

  get object3D() {
    return this.root;
  }

  /** World-space player position — Tumi's detection system checks against this. */
  getPosition() {
    return this.root.position;
  }

  /** Show/hide the whole body mesh — used to hide the avatar in first-person view. */
  setVisible(visible) {
    this.root.visible = visible;
  }

  update(delta, moveState) {
    if (moveState.moving) {
      this.walkTime += delta * 6 * moveState.speed;
    }

    const amp = moveState.moving ? 0.6 : Math.max(0, 0.6 - delta * 3);
    const swing = Math.sin(this.walkTime) * amp;
    const counterSwing = Math.sin(this.walkTime + Math.PI) * amp;

    this.leftArm.shoulder.rotation.x = counterSwing * 0.5;
    this.rightArm.shoulder.rotation.x = swing * 0.5;

    this.leftLeg.shoulder.rotation.x = swing;
    this.rightLeg.shoulder.rotation.x = counterSwing;

    // Bend the knees while walking and especially while airborne, instead of
    // leaving the legs rigid during a jump.
    const airborne = !moveState.grounded;
    const jumpBend = airborne ? THREE.MathUtils.clamp(
      0.35 + Math.max(0, -moveState.verticalVelocity) * 0.035, 0.35, 0.85
    ) : 0;
    this.leftLeg.elbow.rotation.x = Math.max(0, -swing) * 0.8 + jumpBend;
    this.rightLeg.elbow.rotation.x = Math.max(0, -counterSwing) * 0.8 + jumpBend;

    // During a door interaction, reach the right hand toward the door.
    if (this.doorInteraction) {
      const { target, progress } = this.doorInteraction;
      const localTarget = this.root.worldToLocal(target.clone());
      const reach = Math.sin(progress * Math.PI);
      const armAngle = THREE.MathUtils.clamp(
        -Math.atan2(localTarget.z, Math.max(0.35, localTarget.y - 1.0)) * 0.9,
        -1.35, 1.35
      );
      this.rightArm.shoulder.rotation.x =
        THREE.MathUtils.lerp(this.rightArm.shoulder.rotation.x, armAngle, reach);
      this.rightArm.shoulder.rotation.z = THREE.MathUtils.lerp(
        this.rightArm.shoulder.rotation.z, localTarget.x > 0 ? -0.25 : 0.25, reach
      );
      this.rightArm.elbow.rotation.x = THREE.MathUtils.lerp(0, -0.55, reach);
    } else {
      this.rightArm.shoulder.rotation.z = 0;
      this.rightArm.elbow.rotation.x = 0;
    }
  }

  startDoorInteraction(doorWorldPos) {
    this.doorInteraction = { target: doorWorldPos.clone(), progress: 0 };
  }

  updateDoorInteraction(delta) {
    if (!this.doorInteraction) return;
    this.doorInteraction.progress = Math.min(1, this.doorInteraction.progress + delta * 3.5);
    if (this.doorInteraction.progress >= 1) {
      // Keep the arm in the reached pose briefly; the door itself is animated
      // independently by TestLevel.
      this.doorInteraction.hold = true;
    }
  }

  stopDoorInteraction() {
    this.doorInteraction = null;
    this.rightArm.shoulder.rotation.z = 0;
  }

  lookAt(targetWorldPos) {
    const local = this.headJoint.worldToLocal(targetWorldPos.clone());
    const targetYaw = Math.atan2(local.x, local.z);
    this.headJoint.rotation.y += (targetYaw - this.headJoint.rotation.y) * 0.15;
  }
}
