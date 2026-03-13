import { StyleSheet, View } from 'react-native';
import { RoundOverviewItem } from '../types/play';
import { RoundOverviewCard } from './RoundOverviewCard';

type Props = {
  items: RoundOverviewItem[];
  onSelectHole: (holeNumber: number) => void;
};

export function RoundOverviewList({ items, onSelectHole }: Props) {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <RoundOverviewCard key={item.holeNumber} item={item} onPress={() => onSelectHole(item.holeNumber)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ list: { gap: 8 } });
