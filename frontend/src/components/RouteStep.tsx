import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

interface JourneyStepProps {
  time: string;
  title: string;
  description: string;
  type: 'start' | 'bus' | 'finish';
  isLast?: boolean;
  highlight?: string;
  highlightSecondary?: string;
}

export const RouteStep = ({ 
  time, 
  title, 
  description, 
  type, 
  isLast, 
  highlight, 
  highlightSecondary 
}: JourneyStepProps) => {
  const getIcon = () => {
    switch (type) {
      case 'bus': return <Ionicons name="bus" size={16} color={colors.white} />;
      case 'finish': return <Ionicons name="flag" size={16} color={colors.white} />;
      case 'start': return <Ionicons name="walk" size={14} color={colors.white} />;
      default: return null;
    }
  };

  const getDotStyle = () => {
    switch (type) {
      case 'bus': return styles.stepDotBus;
      case 'finish': return styles.stepDotFinish;
      default: return styles.stepDotActive;
    }
  };

  return (
    <View style={[styles.stepRow, isLast && { marginBottom: 0 }]}>
      <View style={styles.stepIndicator}>
        {!isLast && <View style={styles.stepLine} />}
        <View style={getDotStyle()}>
          {getIcon()}
        </View>
      </View>
      <View style={styles.stepContent}>
        <View style={styles.timeHeader}>
           <Text style={styles.stepTime}>{time}</Text>
        </View>
        <Text style={styles.stepTitle} maxFontSizeMultiplier={1.2}>{title}</Text>
        
        {type === 'bus' ? (
          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
               <Text style={styles.stepDescription}>No ponto: </Text>
               <Text style={styles.highlight}>{highlight}</Text>
            </View>
            <View style={styles.detailRow}>
               <Text style={styles.stepDescription}>Desça em: </Text>
               <Text style={styles.highlight}>{highlightSecondary}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.stepDescription} maxFontSizeMultiplier={1.1}>{description}</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  stepRow: {
    flexDirection: 'row',
    minHeight: 80,
  },
  stepIndicator: {
    width: 40,
    alignItems: 'center',
    position: 'relative',
  },
  stepDotActive: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    marginTop: 0,
  },
  stepDotBus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    marginTop: -2,
  },
  stepDotFinish: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    marginTop: -2,
  },
  stepLine: {
    position: 'absolute',
    top: 10,
    bottom: -10,
    width: 3,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
  },
  stepContent: {
    flex: 1,
    paddingLeft: 16,
    paddingBottom: 28,
  },
  timeHeader: {
    marginBottom: 2,
  },
  stepTime: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  stepTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#011030',
    lineHeight: 24,
  },
  detailsContainer: {
    marginTop: 6,
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  stepDescription: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '600',
    lineHeight: 22,
  },
  highlight: {
    fontSize: 16,
    fontWeight: '800',
    color: '#011030',
    lineHeight: 22,
  },
});
