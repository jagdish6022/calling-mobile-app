import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const getStyle = () => {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return { bg: '#2A2A1A', text: '#FFD54F', label: 'Pending' };
      case 'DIALING':
        return { bg: '#0D2D5E', text: '#40C4FF', label: 'Dialing' };
      case 'COMPLETED':
        return { bg: '#0A3B18', text: '#69F0AE', label: 'Completed' };
      case 'FAILED':
        return { bg: '#420C15', text: '#FF5252', label: 'Failed' };
      case 'BUSY':
        return { bg: '#3D1B04', text: '#FFAB40', label: 'Busy' };
      case 'NO_ANSWER':
        return { bg: '#290B38', text: '#E040FB', label: 'No Answer' };
      case 'REJECTED':
        return { bg: '#3E0A0A', text: '#FF6E40', label: 'Rejected' };
      default:
        return { bg: '#222225', text: '#B0B4BA', label: status };
    }
  };

  const config = getStyle();

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
