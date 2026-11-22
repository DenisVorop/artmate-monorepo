type ClusterablePickupPoint = {
  id: string;
  latitude: number;
  longitude: number;
};

export type PickupPointCluster<T extends ClusterablePickupPoint> = {
  id: string;
  latitude: number;
  longitude: number;
  pointIds: string[];
  points: T[];
};

const tileSize = 256;
const clusterGridSizePx = 64;

export function clusterPickupPoints<T extends ClusterablePickupPoint>(
  points: readonly T[],
  zoom: number,
): PickupPointCluster<T>[] {
  const scale = tileSize * 2 ** Math.max(0, Math.round(zoom));
  const cells = new Map<string, T[]>();

  for (const point of [...points].sort((left, right) => left.id.localeCompare(right.id))) {
    const x = ((point.longitude + 180) / 360) * scale;
    const latitude = Math.max(-85.051_129, Math.min(85.051_129, point.latitude));
    const sinLatitude = Math.sin((latitude * Math.PI) / 180);
    const y = (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * scale;
    const cellId = `${Math.floor(x / clusterGridSizePx)}:${Math.floor(y / clusterGridSizePx)}`;
    const cell = cells.get(cellId);

    if (cell) cell.push(point);
    else cells.set(cellId, [point]);
  }

  return [...cells.values()]
    .map((cellPoints) => ({
      id: cellPoints.map((point) => point.id).join("|"),
      latitude: cellPoints.reduce((sum, point) => sum + point.latitude, 0) / cellPoints.length,
      longitude: cellPoints.reduce((sum, point) => sum + point.longitude, 0) / cellPoints.length,
      pointIds: cellPoints.map((point) => point.id),
      points: cellPoints,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}
