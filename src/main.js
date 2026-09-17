import * as THREE from 'three';
import { Player } from './Player.js';
import { PlayerController } from './PlayerController.js';
import { TestLevel } from './TestLevel.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b9e8); // daytime sky

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 150);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// low night-time ambient — rooms brighten individually as you enter them (see TestLevel)
const hemi = new THREE.HemisphereLight(0xdff1ff, 0x8a765d, 1.5);
scene.add(hemi);

// Daylight key light so the building and character read as a daytime scene.
const sun = new THREE.DirectionalLight(0xfff4dc, 2.2);
sun.position.set(-18, 28, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const level = new TestLevel(scene);

const player = new Player();
player.object3D.position.set(-15, 0, 0); // start in the middle of Room 1
scene.add(player.object3D);

const controller = new PlayerController(camera, renderer.domElement, player, level);
controller.onInteract(() => {
  const doorToggled = level.tryInteract(player.getPosition());
  if (doorToggled) {
    player.startDoorInteraction(doorToggled.pivot.position);
    // Reset the interaction after the door-opening gesture has had time to play.
    setTimeout(() => player.stopDoorInteraction(), 900);
  } else {
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
