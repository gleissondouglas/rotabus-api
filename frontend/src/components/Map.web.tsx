import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors as themeColors } from '../theme/colors';

interface Coords {
  latitude: number;
  longitude: number;
}

interface MapProps {
  userLocation: Coords | null;
  stopCoords: Coords | null;
  destCoords: Coords | null;
  transferCoords?: Coords[];
  polylineCoords: Coords[];
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  colors: any;
}

const Map: React.FC<MapProps> = () => {
  return (
    <View style={styles.mapFallback}>
      <Text style={styles.mapIcon}>🌐</Text>
      <Text style={styles.mapText}>Mapa disponível no celular.</Text>
      <Text style={styles.mapSubText}>Siga as instruções de voz abaixo.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  mapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#F8FAFF',
  },
  mapIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  mapText: {
    fontSize: 15,
    fontWeight: '700',
    color: themeColors.text,
    textAlign: 'center',
  },
  mapSubText: {
    fontSize: 13,
    color: themeColors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
});

export default Map;
