import * as THREE from 'three';
import { Player } from './Player.js';
import { PlayerController } from './PlayerController.js';
import { TestLevel } from './TestLevel.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111318); // still night — dark background

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 150);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// low night-time ambient — rooms brighten individually as you enter them (see TestLevel)
const hemi = new THREE.HemisphereLight(0x8899aa, 0x111318, 0.6);
scene.add(hemi);

const level = new TestLevel(scene);

const player = new Player();
player.object3D.position.set(-15, 0, 0); // start in the middle of Room 1
scene.add(player.object3D);

const controller = new PlayerController(camera, renderer.domElement, player, level);
controller.onInteract(() => {
  const doorToggled = level.tryInteract(player.getPosition());
  if (!doorToggled) {
    console.log('interact pressed (no door in range) at', player.getPosition());
  }
});

const interactPrompt = document.getElementById('interact-prompt');

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  controller.update(delta);
  level.update(delta, player.getPosition());

  interactPrompt.style.display = level.hasNearbyDoor(player.getPosition()) ? 'block' : 'none';

  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
