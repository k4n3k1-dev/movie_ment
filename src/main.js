import * as THREE from 'three';
import { Player } from './Player.js';
import { PlayerController } from './PlayerController.js';
import { TestLevel } from './TestLevel.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ec8e7);
scene.fog = new THREE.Fog(0x9ec8e7, 38, 75);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 120);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const level = new TestLevel(scene);

const player = new Player();
// The robbery begins in the yard, outside the front entrance.
player.object3D.position.set(-4.4, 0, 15.3);
scene.add(player.object3D);

const controller = new PlayerController(camera, renderer.domElement, player, level);
controller.onInteract(() => {
  const door = level.tryInteract(player.getPosition());
  if (door) {
    player.startDoorInteraction(door.pivot.position);
    setTimeout(() => player.stopDoorInteraction(), 950);
  }
});

const interactPrompt = document.getElementById('interact-prompt');
const status = document.getElementById('status');
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.033);
  controller.update(delta);
  level.update(delta, player.getPosition());
  interactPrompt.style.display = level.hasNearbyDoor(player.getPosition()) ? 'block' : 'none';
  status.textContent = controller.crawling ? 'Crawling' : (controller.grounded ? 'Ready' : 'Airborne');
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});
