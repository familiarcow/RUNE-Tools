export type BoundarySnapshotRow = {
  node_address: string;
  slash_points: number;
  status: string;
};

export type LeaderboardRow = {
  rank: number;
  node_address: string;
  perWindow: Array<number | null>;
  total: number;
  avgPerChurn: number;
  participation: number;
};

export type LeaderboardResult = {
  rows: LeaderboardRow[];
  requestedWindows: number;
  computedWindows: number;
};

export function normalizeBoundarySnapshot(nodes: any[]): BoundarySnapshotRow[] {
  if (!Array.isArray(nodes)) {
    return [];
  }

  return nodes
    .filter((node) => Boolean(node?.node_address))
    .map((node) => ({
      node_address: String(node.node_address),
      slash_points: Number(node.slash_points) || 0,
      status: String(node.status || '')
    }));
}

function buildSlashMap(snapshot: BoundarySnapshotRow[]): Map<string, number> {
  const map = new Map<string, number>();

  for (const row of snapshot || []) {
    map.set(row.node_address, Number(row.slash_points) || 0);
  }

  return map;
}

export function computeLeaderboardRows(options: {
  churnHeights: number[];
  snapshotsByHeight: Record<number, BoundarySnapshotRow[]>;
  minParticipation?: number;
  maxWindows?: number;
}): LeaderboardResult {
  const churnHeights = Array.isArray(options?.churnHeights) ? options.churnHeights : [];
  const snapshotsByHeight = options?.snapshotsByHeight || {};
  const minParticipation = Number(options?.minParticipation ?? 3);
  const maxWindows = Number(options?.maxWindows ?? 10);

  const requestedWindows = Math.min(maxWindows, Math.max(0, churnHeights.length - 1));
  const rowsByNode = new Map<string, Omit<LeaderboardRow, 'rank'>>();

  let computedWindows = 0;

  for (let windowIndex = 0; windowIndex < requestedWindows; windowIndex += 1) {
    const endHeight = Number(churnHeights[windowIndex]);
    const startHeight = Number(churnHeights[windowIndex + 1]);

    const endSnapshot = snapshotsByHeight[endHeight];
    const startSnapshot = snapshotsByHeight[startHeight];

    if (!Array.isArray(endSnapshot) || !Array.isArray(startSnapshot)) {
      continue;
    }

    computedWindows += 1;

    const startSlashMap = buildSlashMap(startSnapshot);

    for (const node of endSnapshot) {
      const nodeAddress = node.node_address;
      const endSlash = Number(node.slash_points) || 0;
      const startSlash = startSlashMap.get(nodeAddress) ?? 0;
      const delta = Math.max(0, endSlash - startSlash);

      if (!rowsByNode.has(nodeAddress)) {
        rowsByNode.set(nodeAddress, {
          node_address: nodeAddress,
          perWindow: Array(maxWindows).fill(null),
          total: 0,
          avgPerChurn: 0,
          participation: 0
        });
      }

      const row = rowsByNode.get(nodeAddress)!;
      row.perWindow[windowIndex] = delta;
      row.total += delta;
      row.participation += 1;
    }
  }

  const rows = Array.from(rowsByNode.values())
    .filter((row) => row.participation >= minParticipation)
    .map((row) => ({
      ...row,
      avgPerChurn: row.participation > 0 ? row.total / row.participation : 0
    }))
    .sort((a, b) => {
      if (a.total !== b.total) return a.total - b.total;
      if (a.avgPerChurn !== b.avgPerChurn) return a.avgPerChurn - b.avgPerChurn;
      return a.node_address.localeCompare(b.node_address);
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1
    }));

  return {
    rows,
    requestedWindows,
    computedWindows
  };
}
