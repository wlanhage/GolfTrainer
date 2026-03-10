import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppStackParamList } from '../../../app/navigation/RootNavigator';
import { trainingMissions } from '../data/trainingMissions';

type Props = NativeStackScreenProps<AppStackParamList, 'TrainingList'>;

export function TrainingListScreen({ navigation }: Props) {
  const onMissionPress = (missionId: string, title: string) => {
    Alert.alert('Starta träningsmission', `Är du säker att du vill starta "${title}"?`, [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Starta',
        style: 'default',
        onPress: () => navigation.navigate('TrainingMission', { missionId })
      }
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Träningsmissioner</Text>
      <Text style={styles.subtitle}>Välj en mission och registrera ditt resultat.</Text>

      <View style={styles.list}>
        {trainingMissions.map((mission) => (
          <Pressable
            key={mission.id}
            onPress={() => onMissionPress(mission.id, mission.title)}
            style={styles.item}
          >
            <Text style={styles.symbol}>{mission.symbol}</Text>
            <View style={styles.itemTextWrap}>
              <Text style={styles.itemTitle}>{mission.title}</Text>
              <Text style={styles.itemDescription} numberOfLines={2}>
                {mission.objective}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f1f5f9',
    flexGrow: 1,
    gap: 8
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827'
  },
  subtitle: {
    fontSize: 15,
    color: '#4b5563',
    marginBottom: 8
  },
  list: {
    gap: 12
  },
  item: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  symbol: {
    fontSize: 28
  },
  itemTextWrap: {
    flex: 1
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827'
  },
  itemDescription: {
    color: '#4b5563',
    marginTop: 2
  }
});
