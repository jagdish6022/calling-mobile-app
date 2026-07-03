import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  borderColor?: string;
  glow?: boolean;
}

export default function GlassCard({ children, style, borderColor = 'rgba(255, 255, 255, 0.08)', glow = false }: GlassCardProps) {
  return (
    <View style={[
      styles.card,
      { borderColor },
      glow && {
        shadowColor: borderColor === 'rgba(255, 255, 255, 0.08)' ? '#000' : borderColor,
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 10,
      },
      style
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#161622', // Darker elegant backdrop
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  }
});
