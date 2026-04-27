import { Image, StyleSheet, Text, View } from 'react-native';

type UserAvatarProps = {
  avatarImage?: string | null;
  displayName?: string | null;
  email?: string | null;
  size?: number;
};

export function UserAvatar({ avatarImage, displayName, email, size = 40 }: UserAvatarProps) {
  const initial = (displayName ?? email ?? 'G').trim().charAt(0).toUpperCase();

  if (avatarImage) {
    return <Image source={{ uri: avatarImage }} style={[styles.avatarImage, { width: size, height: size }]} />;
  }

  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarInitial, { fontSize: Math.max(14, size * 0.38) }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarImage: {},
  avatarFallback: {
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarInitial: {
    color: '#ffffff',
    fontWeight: '700'
  }
});
