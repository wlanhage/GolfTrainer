import { Pressable, StyleSheet, Text, View } from 'react-native';

type LandingPoint = {
  x: number;
  y: number;
};

type HeatmapCell = {
  id: string;
  row: number;
  col: number;
  count: number;
  percentage: number;
};

type Props = {
  points: LandingPoint[];
  onCellPress?: (cell: HeatmapCell) => void;
};

const GRID_SIZE = 7;
const BIN_SIZE_METERS = 10;

const getCellColor = (intensity: number) => {
  if (intensity <= 0) return '#f1f5f9';
  if (intensity < 0.2) return '#f3e8e8';
  if (intensity < 0.4) return '#f0f1d9';
  if (intensity < 0.6) return '#dfee9a';
  if (intensity < 0.8) return '#bbeb6c';
  return '#8fe869';
};

const getBinIndex = (value: number) => {
  const half = Math.floor(GRID_SIZE / 2);
  const raw = Math.round(value / BIN_SIZE_METERS);
  const bounded = Math.max(-half, Math.min(half, raw));
  return bounded + half;
};

export function CaddyLandingHeatmap({ points, onCellPress }: Props) {
  const total = points.length;

  if (total === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>Ingen slagdata ännu – lägg till slag för att visa heatmap.</Text>
      </View>
    );
  }

  const counts: number[][] = Array.from({ length: GRID_SIZE }).map(() => Array.from({ length: GRID_SIZE }).map(() => 0));

  for (const point of points) {
    const col = getBinIndex(point.x);
    const rowFromBottom = getBinIndex(point.y);
    const row = GRID_SIZE - 1 - rowFromBottom;
    counts[row][col] += 1;
  }

  let maxCount = 1;
  for (const row of counts) {
    for (const value of row) {
      if (value > maxCount) {
        maxCount = value;
      }
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {counts.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.row}>
            {row.map((count, colIndex) => {
              const percentage = Math.round((count / total) * 100);
              const cell = {
                id: `${rowIndex}-${colIndex}`,
                row: rowIndex,
                col: colIndex,
                count,
                percentage
              };

              return (
                <Pressable
                  key={cell.id}
                  style={[styles.cell, { backgroundColor: getCellColor(count / maxCount) }]}
                  onPress={() => count > 0 && onCellPress?.(cell)}
                >
                  {count > 0 ? <Text style={styles.cellText}>{percentage}%</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <Text style={styles.legend}>Tryck på en ruta för detaljer.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10
  },
  grid: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#e5e7eb',
    padding: 6
  },
  row: {
    flexDirection: 'row'
  },
  cell: {
    width: 42,
    height: 42,
    margin: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4
  },
  cellText: {
    fontWeight: '600',
    color: '#111827'
  },
  legend: {
    fontSize: 12,
    color: '#6b7280'
  },
  emptyWrap: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#f8fafc'
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b'
  }
});
