import * as THREE from 'three';
import { Player } from './Player.js';
import { PlayerController } from './PlayerController.js';
import { TestLevel } from './TestLevel.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc8e8);
scene.fog = new THREE.Fog(0x9cc8e8, 42, 85);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.05, 160);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xe9f5ff, 0x5f543f, 1.75);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff1d2, 3.2);
sun.position.set(-24, 32, -18);
sun.castShadow = true;
sun.shadow.mapSize.set(3072, 3072);
sun.shadow.camera.left = -35;
sun.shadow.camera.right = 35;
sun.shadow.camera.top = 35;
sun.shadow.camera.bottom = -35;
sun.shadow.bias = -0.00015;
scene.add(sun);

const level = new TestLevel(scene);
const player = new Player();
// Outside the front gate, facing the house.
player.object3D.position.set(0, 0, -17.0);
player.object3D.rotation.y = 0;
scene.add(player.object3D);

const controller = new PlayerController(camera, renderer.domElement, player, level);
controller.yaw = 0;
controller.onInteract(() => {
  const door = level.tryInteract(player.getPosition());
  if (door) {
    player.startDoorInteraction(door.pivot.position);
    setTimeout(() => player.stopDoorInteraction(), 850);
  }
});

const prompt = document.getElementById('interact-prompt');
const status = document.getElementById('status');

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.033);
  controller.update(delta);
  level.update(delta, player.getPosition());
  player.updateDoorInteraction(delta);

  const nearby = level.hasNearbyDoor(player.getPosition());
  prompt.style.display = nearby ? 'block' : 'none';
  status.textContent = controller.cameraMode === 'first' ? 'FIRST PERSON' : controller.cameraMode === 'top' ? 'TACTICAL VIEW' : 'THIRD PERSON';
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
