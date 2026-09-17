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
 * Why each parent-child relationship exists (for the demo):
 * - The hand is a child of the forearm: when the elbow rotates, the hand follows
 *   automatically but keeps its own local transform (e.g. it could hold an item
 *   without extra bookkeeping).
 * - The head is a child of the torso, not the root: the head can turn to "look"
 *   at something without moving or rotating the whole body.
 * - Legs are children of the root, not the torso: hip rotation shouldn't be
 *   coupled to any torso lean you might add later (e.g. crouching).
 *
 * Swap the primitive meshes for a rigged GLB later without touching
 * PlayerController or the getPosition() contract below — everything downstream
 * only depends on `object3D` and `getPosition()`.
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
    this.headJoint.position.set(0, 0.45, 0); // local to torso
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
  }

  /**
   * Builds a two-segment limb: joint -> upperSegment -> subJoint -> lowerSegment -> endJoint
   * Returns the three joints (shoulder/hip, elbow/knee, hand/foot) so callers can
   * drive rotation for animation.
   */
  _buildLimb(bodyMat, skinMat, upperLen, lowerLen, isLeg) {
    const shoulder = new THREE.Group(); // shoulder or hip joint

    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.14, upperLen, 0.14), bodyMat);
    upper.position.y = -upperLen / 2;
    upper.castShadow = true;
    shoulder.add(upper);

    const elbow = new THREE.Group(); // elbow or knee joint
    elbow.position.y = -upperLen;
    shoulder.add(elbow);

    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.12, lowerLen, 0.12), bodyMat);
    lower.position.y = -lowerLen / 2;
    lower.castShadow = true;
    elbow.add(lower);

    const end = new THREE.Group(); // hand or foot joint
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

  /** World-space player position — this is the integration contract for Tumi's
   *  detection system (guards/cameras check distance & line-of-sight against this). */
  getPosition() {
    return this.root.position;
  }

  /** Call once per frame. moveState = { moving: bool, speed: number (0 when idle) } */
  update(delta, moveState) {
    if (moveState.moving) {
      this.walkTime += delta * 6 * moveState.speed;
    }

    const amp = moveState.moving ? 0.6 : Math.max(0, 0.6 - delta * 3); // ease out when stopping
    const swing = Math.sin(this.walkTime) * amp;
    const counterSwing = Math.sin(this.walkTime + Math.PI) * amp;

    this.leftArm.shoulder.rotation.x = counterSwing * 0.5;
    this.rightArm.shoulder.rotation.x = swing * 0.5;

    this.leftLeg.shoulder.rotation.x = swing;
    this.rightLeg.shoulder.rotation.x = counterSwing;

    // knee bends only on the forward part of the swing, not the backward part
    this.leftLeg.elbow.rotation.x = Math.max(0, -swing) * 0.8;
    this.rightLeg.elbow.rotation.x = Math.max(0, -counterSwing) * 0.8;
  }

  /** Turn the head toward a world-space point without rotating the body (damped). */
  lookAt(targetWorldPos) {
    const local = this.headJoint.worldToLocal(targetWorldPos.clone());
    const targetYaw = Math.atan2(local.x, local.z);
    this.headJoint.rotation.y += (targetYaw - this.headJoint.rotation.y) * 0.15;
  }
}
