import './style.css';
import * as THREE from 'three';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 0, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.domElement.id = 'three-canvas';
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.4);
directionalLight.position.set(-1, 2, 4);
scene.add(directionalLight);

const geometry = new THREE.IcosahedronGeometry(1.2, 1);
const material = new THREE.MeshStandardMaterial({
  color: 0x1f8ef1,
  metalness: 0.1,
  roughness: 0.4,
  wireframe: true
});
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

const clock = new THREE.Clock();

const resize = () => {
  const { innerWidth, innerHeight } = window;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
};

window.addEventListener('resize', resize);

const animate = () => {
  const elapsed = clock.getElapsedTime();
  mesh.rotation.x = elapsed * 0.2;
  mesh.rotation.y = elapsed * 0.3;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
};

animate();

const uiCanvas = document.getElementById('ui-canvas') as HTMLCanvasElement | null;
if (uiCanvas) {
  const ctx = uiCanvas.getContext('2d');
  if (ctx) {
    const { width, height } = uiCanvas;
    ctx.clearRect(0, 0, width, height);
    const padding = 28;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.strokeRect(padding, padding, width - padding * 2, height - padding * 2);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(centerX, padding + 12);
    ctx.lineTo(centerX, height - padding - 12);
    ctx.moveTo(padding + 12, centerY);
    ctx.lineTo(width - padding - 12, centerY);
    ctx.stroke();

    ctx.font = '600 13px \"JetBrains Mono\", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fillText('EMBEDDING FIELD', centerX, centerY - 6);

    ctx.font = '400 12px \"Space Grotesk\", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillText('Drop a CSV or TSV to begin', centerX, centerY + 16);
  }
}

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
const handleFiles = (files: File[]) => {
  const supported = files.filter((file) => /\.t?csv$/i.test(file.name));
  if (supported.length) {
    console.log('Queued files for embedding preprocessing:', supported.map((f) => f.name));
  } else if (files.length) {
    console.warn('Unsupported file dropped. Please use CSV/TSV.');
  }
};

if (dropZone) {
  const setDragState = (active: boolean) => {
    dropZone.classList.toggle('drag-active', active);
  };

  const preventDefaults = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  dropZone.addEventListener('click', () => {
    fileInput?.click();
  });

  ['dragenter', 'dragover'].forEach((type) => {
    dropZone.addEventListener(type, (event) => {
      preventDefaults(event);
      setDragState(true);
    });
  });

  ['dragleave', 'drop'].forEach((type) => {
    dropZone.addEventListener(type, (event) => {
      preventDefaults(event);
      if (type === 'drop') {
        const files = Array.from(event.dataTransfer?.files ?? []);
        handleFiles(files);
      }
      setDragState(false);
    });
  });
}

if (fileInput) {
  fileInput.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    const files = Array.from(target.files ?? []);
    handleFiles(files);
    target.value = '';
  });
}
