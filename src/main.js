import * as THREE from 'three';
import { Player } from './Player.js';
import { PlayerController } from './PlayerController.js';
import { TestLevel } from './TestLevel.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111318);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0x8899aa, 0x111318, 0.5);
scene.add(hemi);

// --- Temporary 3-room test building, replace with Sino's museum later ---
const level = new TestLevel(scene);

// --- Player ---
const player = new Player();
player.object3D.position.set(-6, 0, 0); // start in Room 1
scene.add(player.object3D);

const controller = new PlayerController(camera, renderer.domElement, player, level);
controller.onInteract(() => {
  const doorToggled = level.tryInteract(player.getPosition());
  if (!doorToggled) {
    // No door in range — this is Tumi's hook for artwork stealing instead.
    console.log('interact pressed (no door in range) at', player.getPosition());
  }
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  controller.update(delta);
  level.update(delta);
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
