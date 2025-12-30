import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type Point = {
  id: number;
  x: number;
  y: number;
  z: number;
  cluster: number;
  radius: number;
};

const canvas = document.querySelector<HTMLCanvasElement>('#embedding-canvas');
if (!canvas) {
  throw new Error('Embedding canvas not found.');
}

const tooltip = document.querySelector<HTMLDivElement>('#hover-tooltip');
const stageFrame = canvas.closest<HTMLElement>('.stage-frame');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.Fog(0x000000, 2, 8);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
camera.position.set(0.8, 0.6, 3.4);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setClearColor(0x000000, 1);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = true;
controls.screenSpacePanning = true;
controls.minDistance = 1.2;
controls.maxDistance = 10;
controls.rotateSpeed = 0.6;
controls.zoomSpeed = 0.8;
controls.target.set(0, 0, 0);

const grid = new THREE.GridHelper(4.5, 14, 0x3a3a3a, 0x1f1f1f);
(grid.material as THREE.Material).opacity = 0.45;
(grid.material as THREE.Material).transparent = true;
scene.add(grid);

const axes = new THREE.AxesHelper(1.2);
axes.setColors(0xffffff, 0x7d7d7d, 0x3d3d3d);
scene.add(axes);

const mockCsv = buildMockCsv(180);
const points = parseCsv(mockCsv);
const pointCloud = createPointCloud(points);
scene.add(pointCloud);

const raycaster = new THREE.Raycaster();
raycaster.params.Points!.threshold = 0.08;
const pointer = new THREE.Vector2(2, 2);
let pointerClientX = 0;
let pointerClientY = 0;
let pointerInside = false;
let hoveredIndex: number | null = null;

const resizeObserver = new ResizeObserver(() => resize());
resizeObserver.observe(canvas);
window.addEventListener('resize', resize);
resize();

canvas.addEventListener('pointermove', (event) => {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }

  pointerInside = true;
  pointerClientX = event.clientX;
  pointerClientY = event.clientY;
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
});

canvas.addEventListener('pointerleave', () => {
  pointerInside = false;
  pointer.set(2, 2);
  clearHover();
});

let lastTime = 0;
requestAnimationFrame(animate);

function animate(time: number) {
  const delta = Math.min((time - lastTime) / 1000, 0.033);
  lastTime = time;
  controls.update();
  updateHover();
  pointCloud.rotation.y += delta * 0.05;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }

  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
  renderer.setSize(rect.width, rect.height, false);
}

function updateHover() {
  if (!pointerInside) {
    return;
  }

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(pointCloud, false);
  const hitIndex = hits.length > 0 ? hits[0].index ?? null : null;

  if (hitIndex === null) {
    if (hoveredIndex !== null) {
      clearHover();
    }
    return;
  }

  if (hitIndex !== hoveredIndex) {
    hoveredIndex = hitIndex;
    const point = points[hitIndex];
    showTooltip(point);
  }

  positionTooltip();
}

function showTooltip(point: Point) {
  if (!tooltip) {
    return;
  }

  tooltip.textContent = `id ${point.id} | x ${point.x.toFixed(2)} y ${point.y.toFixed(2)} z ${point.z.toFixed(2)}`;
  tooltip.classList.add('is-visible');
}

function clearHover() {
  hoveredIndex = null;
  if (tooltip) {
    tooltip.classList.remove('is-visible');
  }
}

function positionTooltip() {
  if (!tooltip || !stageFrame) {
    return;
  }

  const frameRect = stageFrame.getBoundingClientRect();
  const offset = 14;
  let x = pointerClientX - frameRect.left + offset;
  let y = pointerClientY - frameRect.top + offset;
  const tooltipRect = tooltip.getBoundingClientRect();
  const maxX = Math.max(8, frameRect.width - tooltipRect.width - 8);
  const maxY = Math.max(8, frameRect.height - tooltipRect.height - 8);

  x = clamp(x, 8, maxX);
  y = clamp(y, 8, maxY);
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function createPointCloud(data: Point[]) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(data.length * 3);
  const colors = new Float32Array(data.length * 3);
  const palette = [
    new THREE.Color('#f5f5f5'),
    new THREE.Color('#bdbdbd'),
    new THREE.Color('#707070'),
  ];

  data.forEach((point, index) => {
    const i = index * 3;
    positions[i] = point.x;
    positions[i + 1] = point.y;
    positions[i + 2] = point.z;
    const color = palette[point.cluster % palette.length];
    colors[i] = color.r;
    colors[i + 1] = color.g;
    colors[i + 2] = color.b;
  });

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.05,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}

function buildMockCsv(count: number) {
  const rng = mulberry32(42);
  const clusters = [
    { x: -0.7, y: -0.2, z: 0.2 },
    { x: 0.65, y: -0.15, z: -0.2 },
    { x: 0.1, y: 0.6, z: 0.5 },
    { x: -0.2, y: 0.1, z: -0.6 },
  ];
  const rows = ['id,x,y,z,cluster'];

  for (let i = 0; i < count; i += 1) {
    const cluster = i % clusters.length;
    const jitter = 0.22;
    const center = clusters[cluster];
    const x = clamp(center.x + randomNormal(rng) * jitter, -1, 1);
    const y = clamp(center.y + randomNormal(rng) * jitter, -1, 1);
    const z = clamp(center.z + randomNormal(rng) * jitter, -1, 1);
    rows.push(`${i},${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)},${cluster}`);
  }

  return rows.join('\n');
}

function parseCsv(text: string): Point[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length <= 1) {
    return [];
  }

  const points: Point[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) {
      continue;
    }

    const [idValue, xValue, yValue, zValue, clusterValue] = line.split(',');
    const x = Number.parseFloat(xValue);
    const y = Number.parseFloat(yValue);
    const z = Number.parseFloat(zValue);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      continue;
    }

    const id = Number.parseInt(idValue ?? '0', 10);
    const cluster = Number.parseInt(clusterValue ?? '0', 10);
    const safeId = Number.isFinite(id) ? id : i;
    points.push({
      id: safeId,
      x,
      y,
      z,
      cluster: Number.isFinite(cluster) ? cluster : 0,
      radius: 2 + (safeId % 8) * 0.35,
    });
  }

  return points;
}

function randomNormal(rng: () => number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
