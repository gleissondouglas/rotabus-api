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
          <View style={styles.busDetailsCard}>
            <View style={styles.detailRow}>
               <Ionicons name="location" size={14} color="#64748B" />
               <Text style={styles.stepDescription}>
                 No ponto: <Text style={styles.highlight}>{highlight}</Text>
               </Text>
            </View>
            <View style={styles.detailRow}>
               <Ionicons name="flag" size={14} color="#64748B" />
               <Text style={styles.stepDescription}>
                 Desça em: <Text style={styles.highlight}>{highlightSecondary}</Text>
               </Text>
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
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  stepDotBus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  stepDotFinish: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  stepLine: {
    position: 'absolute',
    top: 24,
    bottom: -24,
    width: 2,
    backgroundColor: '#E2E8F0',
  },
  stepContent: {
    flex: 1,
    paddingLeft: 16,
    paddingBottom: 32,
  },
  timeHeader: {
    marginBottom: 4,
  },
  stepTime: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 24,
  },
  busDetailsCard: {
    marginTop: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepDescription: {
    flex: 1,
    fontSize: 15,
    color: '#475569',
    fontWeight: '600',
    lineHeight: 22,
  },
  highlight: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
});
