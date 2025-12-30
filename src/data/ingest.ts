export type Point = {
  id: string;
  label?: string;
  x: number;
  y: number;
  z: number;
  cluster: number;
  radius: number;
};

export function buildMockCsv(count: number) {
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

export function parseCsv(text: string): Point[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length <= 1) {
    return [];
  }

  const delimiter = detectDelimiter(lines[0]);
  const headerFields = lines[0].split(delimiter).map((field) => field.trim());
  const hasHeader = headerFields.some((field) => /[a-zA-Z]/.test(field));
  const startIndex = hasHeader ? 1 : 0;
  const normalizedHeaders = headerFields.map(normalizeHeader);
  const xIndex = hasHeader ? findHeaderIndex(normalizedHeaders, ['x', 'xcoord', 'dim1', 'd1', 'pc1', 'pca1', 'umap1', 'tsne1']) : -1;
  const yIndex = hasHeader ? findHeaderIndex(normalizedHeaders, ['y', 'ycoord', 'dim2', 'd2', 'pc2', 'pca2', 'umap2', 'tsne2']) : -1;
  const zIndex = hasHeader ? findHeaderIndex(normalizedHeaders, ['z', 'zcoord', 'dim3', 'd3', 'pc3', 'pca3', 'umap3', 'tsne3']) : -1;
  const idIndex = hasHeader ? findHeaderIndex(normalizedHeaders, ['id', 'uid', 'uuid', 'index']) : -1;
  const labelIndex = hasHeader ? findHeaderIndex(normalizedHeaders, ['label', 'name', 'title', 'text']) : -1;
  const clusterIndex = hasHeader ? findHeaderIndex(normalizedHeaders, ['cluster', 'group', 'class', 'category', 'type']) : -1;
  const clusterMap = new Map<string, number>();

  const points: Point[] = [];
  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) {
      continue;
    }

    const columns = line.split(delimiter).map((value) => value.trim());
    const xValue = xIndex >= 0 ? columns[xIndex] : undefined;
    const yValue = yIndex >= 0 ? columns[yIndex] : undefined;
    const zValue = zIndex >= 0 ? columns[zIndex] : undefined;
    let x = xValue ? Number.parseFloat(xValue) : Number.NaN;
    let y = yValue ? Number.parseFloat(yValue) : Number.NaN;
    let z = zValue ? Number.parseFloat(zValue) : Number.NaN;

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      const numeric = columns
        .map((value) => Number.parseFloat(value))
        .filter((value) => Number.isFinite(value));
      if (numeric.length >= 3) {
        x = numeric[0];
        y = numeric[1];
        z = numeric[2];
      }
    }

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      continue;
    }

    const rawId = idIndex >= 0 ? columns[idIndex] : '';
    const id = rawId ? rawId : `${points.length}`;
    const label = labelIndex >= 0 ? columns[labelIndex] : undefined;
    const clusterValue = clusterIndex >= 0 ? columns[clusterIndex] : '';
    const cluster = parseCluster(clusterValue, clusterMap);
    points.push({
      id,
      label: label || undefined,
      x,
      y,
      z,
      cluster,
      radius: 2 + (points.length % 8) * 0.35,
    });
  }

  return points;
}

function detectDelimiter(line: string) {
  const commaCount = (line.match(/,/g) || []).length;
  const tabCount = (line.match(/\t/g) || []).length;
  if (tabCount > commaCount) {
    return '\t';
  }
  return ',';
}

function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findHeaderIndex(headers: string[], keys: string[]) {
  for (let i = 0; i < headers.length; i += 1) {
    if (keys.includes(headers[i])) {
      return i;
    }
  }
  return -1;
}

function parseCluster(value: string | undefined, map: Map<string, number>) {
  if (!value) {
    return 0;
  }
  const numeric = Number.parseInt(value, 10);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  const key = value.trim();
  if (!key) {
    return 0;
  }
  if (!map.has(key)) {
    map.set(key, map.size);
  }
  return map.get(key) ?? 0;
}

function randomNormal(rng: () => number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function clamp(value: number, min: number, max: number) {
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
