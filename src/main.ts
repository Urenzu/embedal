import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildMockCsv, clamp, parseCsv, type Point } from './data/ingest';

const canvas = document.querySelector<HTMLCanvasElement>('#embedding-canvas');
if (!canvas) {
  throw new Error('Embedding canvas not found.');
}

const tooltip = document.querySelector<HTMLDivElement>('#hover-tooltip');
const stageFrame = canvas.closest<HTMLElement>('.stage-frame');
const ingestPanel = document.querySelector<HTMLDivElement>('#ingest-panel');
const ingestInput = document.querySelector<HTMLInputElement>('#ingest-input');
const ingestButton = document.querySelector<HTMLButtonElement>('#ingest-button');
const ingestStatus = document.querySelector<HTMLDivElement>('#ingest-status');

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
let points = parseCsv(mockCsv);
const material = new THREE.PointsMaterial({
  size: 0.05,
  vertexColors: true,
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
});
const pointCloud = new THREE.Points(new THREE.BufferGeometry(), material);
updatePointCloud(points);
setIngestStatus(`Dataset: mock.csv · ${points.length} pts`);
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

ingestButton?.addEventListener('click', () => {
  ingestInput?.click();
});

ingestInput?.addEventListener('change', () => {
  const file = ingestInput.files?.[0];
  if (!file) {
    return;
  }
  ingestInput.value = '';
  handleFile(file);
});

let dragDepth = 0;
const dropTargets = [stageFrame, ingestPanel].filter(Boolean) as HTMLElement[];

const setDragActive = (active: boolean) => {
  stageFrame?.classList.toggle('is-dragging', active);
  ingestPanel?.classList.toggle('is-dragging', active);
};

dropTargets.forEach((target) => {
  target.addEventListener('dragenter', (event) => {
    event.preventDefault();
    dragDepth += 1;
    setDragActive(true);
  });

  target.addEventListener('dragover', (event) => {
    event.preventDefault();
  });

  target.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      setDragActive(false);
    }
  });

  target.addEventListener('drop', (event) => {
    event.preventDefault();
    dragDepth = 0;
    setDragActive(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      handleFile(file);
    }
  });
});

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

async function handleFile(file: File) {
  try {
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length < 3) {
      setIngestStatus(`Unable to parse ${file.name}`);
      return;
    }
    updatePointCloud(parsed);
    setIngestStatus(`Dataset: ${file.name} · ${parsed.length} pts`);
  } catch (error) {
    console.error(error);
    setIngestStatus(`Failed to load ${file.name}`);
  }
}

function setIngestStatus(message: string) {
  if (ingestStatus) {
    ingestStatus.textContent = message;
  }
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

  if (point.label) {
    tooltip.textContent = `id ${point.id} | ${point.label}`;
  } else {
    tooltip.textContent = `id ${point.id} | x ${point.x.toFixed(2)} y ${point.y.toFixed(2)} z ${point.z.toFixed(2)}`;
  }
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

function updatePointCloud(data: Point[]) {
  points = data;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(data.length * 3);
  const colors = new Float32Array(data.length * 3);
  const clusterColors = new Map<number, THREE.Color>();

  data.forEach((point, index) => {
    const i = index * 3;
    positions[i] = point.x;
    positions[i + 1] = point.y;
    positions[i + 2] = point.z;
    let color = clusterColors.get(point.cluster);
    if (!color) {
      color = colorForCluster(point.cluster);
      clusterColors.set(point.cluster, color);
    }
    colors[i] = color.r;
    colors[i + 1] = color.g;
    colors[i + 2] = color.b;
  });

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  pointCloud.geometry.dispose();
  pointCloud.geometry = geometry;
  fitViewToPoints(geometry.boundingSphere);
}

function fitViewToPoints(bounds: THREE.Sphere | null) {
  if (!bounds) {
    return;
  }
  const radius = Math.max(bounds.radius, 0.5);
  const distance = radius * 3.2;
  controls.target.copy(bounds.center);
  camera.position.copy(bounds.center).add(new THREE.Vector3(distance * 0.35, distance * 0.2, distance));
  controls.minDistance = radius * 0.6;
  controls.maxDistance = radius * 12;
  scene.fog = new THREE.Fog(0x000000, radius * 2.5, radius * 9);
}

function colorForCluster(cluster: number) {
  const hue = ((cluster * 137.508) % 360 + 360) % 360;
  const color = new THREE.Color();
  color.setHSL(hue / 360, 0.65, 0.62);
  return color;
}
