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
      case 'bus': return <Ionicons name="bus" size={18} color={colors.white} />;
      case 'finish': return <Ionicons name="flag" size={18} color={colors.white} />;
      case 'start': return <Ionicons name="walk" size={16} color={colors.white} />;
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
      {/* Timeline indicator */}
      <View style={styles.stepIndicator}>
        {!isLast && <View style={styles.stepLine} />}
        <View style={getDotStyle()}>
          {getIcon()}
        </View>
      </View>

      {/* Content */}
      <View style={[styles.stepContent, isLast && { paddingBottom: 4 }]}>
        <Text style={styles.stepTime} maxFontSizeMultiplier={1.3}>{time}</Text>
        <Text style={styles.stepTitle} maxFontSizeMultiplier={1.2}>{title}</Text>
        
        {type === 'bus' ? (
          <View style={styles.busDetailsCard}>
            {highlight ? (
              <View style={styles.detailRow}>
                <View style={styles.detailIconCircle}>
                  <Ionicons name="location" size={12} color={colors.primary} />
                </View>
                <View style={styles.detailTextCol}>
                  <Text style={styles.detailLabel}>Ponto</Text>
                  <Text style={styles.detailValue} maxFontSizeMultiplier={1.2}>{highlight}</Text>
                </View>
              </View>
            ) : null}
            {highlightSecondary ? (
              <View style={styles.detailRow}>
                <View style={[styles.detailIconCircle, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                  <Ionicons name="flag" size={12} color={colors.success} />
                </View>
                <View style={styles.detailTextCol}>
                  <Text style={styles.detailLabel}>Desça em</Text>
                  <Text style={styles.detailValue} maxFontSizeMultiplier={1.2}>{highlightSecondary}</Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : (
          description ? (
            <Text style={styles.stepDescription} maxFontSizeMultiplier={1.1}>{description}</Text>
          ) : null
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  stepRow: {
    flexDirection: 'row',
    minHeight: 90,
  },
  stepIndicator: {
    width: 44,
    alignItems: 'center',
    position: 'relative',
  },
  stepDotActive: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  stepDotBus: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  stepDotFinish: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  stepLine: {
    position: 'absolute',
    top: 36,
    bottom: -8,
    width: 2.5,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
  },
  stepContent: {
    flex: 1,
    paddingLeft: 16,
    paddingBottom: 36,
  },
  stepTime: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 24,
    marginBottom: 2,
  },
  busDetailsCard: {
    marginTop: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(37,99,235,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTextCol: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 20,
  },
  stepDescription: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '600',
    lineHeight: 22,
    marginTop: 2,
  },
});
