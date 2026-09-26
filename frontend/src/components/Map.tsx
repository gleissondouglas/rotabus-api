import React, { useRef, useEffect, useState, useMemo } from 'react';
import { StyleSheet, View, Platform, TouchableOpacity, Text, useColorScheme } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Callout } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { MapData, MapMarker, MapFocusMode } from '../types/journey.types';
import { decodePolyline } from '../utils/polyline';
import { useThemeColors } from '../theme/colors';

interface MapProps {
  mapData?: MapData;
  userLocation?: {
    latitude: number;
    longitude: number;
    heading?: number | null;
  } | null;
  liveBusPosition?: {
    lat: number;
    lng: number;
    heading?: number | null;
  } | null;
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  colors: any;
  userHeading?: number | null;
  focusMode?: MapFocusMode;
  onFocusModeChange?: (mode: MapFocusMode) => void;
  controlsBottomOffset?: number;
  walkSteps?: any[];
  currentStepIndex?: number;
  isNavigating?: boolean;
  hideControls?: boolean;
  busLine?: string;
  isWaitingBus?: boolean;
}

const cleanMapStyle = [
  { "featureType": "poi", "elementType": "labels", "stylers": [{ "visibility": "off" }] },
  { "featureType": "transit", "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] }
];

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
  { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
  { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#8a8a8a" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
];

const getMarkerColor = (type: MapMarker['type']) => {
  switch (type) {
    case 'boarding_stop': return '#3B82F6';
    case 'transfer_stop': return '#F59E0B';
    case 'dropoff_stop': return '#EF4444';
    case 'destination': return '#8B5CF6';
    case 'user': return '#3B82F6';
    case 'origin': return '#6B7280';
    default: return '#6B7280';
  }
};

/**
 * Componente de Mapa customizado usando react-native-maps.
 * Ele gerencia a exibição da rota, marcadores e o movimento da câmera (seguir usuário).
 */

const Map: React.FC<MapProps> = ({
  mapData,
  userLocation,
  liveBusPosition,
  initialRegion,
  colors: propColors,
  focusMode = 'walking_to_stop',
  onFocusModeChange,
  controlsBottomOffset = 16,
  walkSteps = [],
  currentStepIndex = 0,
  isNavigating = false,
  userHeading,
  hideControls = false,
  busLine,
  isWaitingBus = false,
}) => {
  const mapRef = useRef<MapView>(null);
  // No início da caminhada, mostramos a rota inteira até o ponto enquadrada próxima.
  // O modo de seguir em 3D só é ativado se o usuário clicar no botão de centralizar GPS.
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const colorScheme = useColorScheme();
  const theme = useThemeColors();

  /**
   * Centraliza o mapa no usuário.
   * Se estiver navegando, usa a câmera 3D (pitch) e zoom próximo.
   */
  const handleRecenter = () => {
    if (userLocation && mapRef.current) {
      setIsFollowingUser(true);
      if (isNavigating) {
        mapRef.current.animateCamera({
          center: {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
          },
          pitch: 45,
          heading: userHeading ?? userLocation.heading ?? 0,
          zoom: 19,
          altitude: 260,
        }, { duration: 800 });
      } else {
        mapRef.current.animateToRegion({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.0016,
          longitudeDelta: 0.0016,
        }, 800);
      }
    }
  };

  const [overrideFocusMode, setOverrideFocusMode] = useState<MapFocusMode | null>(null);
  const effectiveFocusMode = overrideFocusMode || focusMode;

  useEffect(() => {
    setOverrideFocusMode(null);
  }, [focusMode]);

  /**
   * Alterna entre ver apenas o caminho até o ponto ou a rota inteira.
   */
  const toggleFocusMode = () => {
    const nextMode = effectiveFocusMode === 'full_route' ? 'walking_to_stop' : 'full_route';
    setOverrideFocusMode(nextMode);
    if (onFocusModeChange) {
      onFocusModeChange(nextMode);
    }
  };

  /**
   * Efeito que controla o enquadramento (Auto-fit) do mapa.
   * Ele decide quais coordenadas devem aparecer na tela baseado no modo de foco.
   */
  useEffect(() => {
    if (!mapRef.current) return;
    let fitTimer: ReturnType<typeof setTimeout> | undefined;

    // Se estiver no modo de navegação ativa com GPS travado no usuário
    if (isNavigating && userLocation && isFollowingUser) {
      mapRef.current.animateCamera({
        center: {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        },
        pitch: 45,
        heading: userHeading ?? userLocation.heading ?? 0,
        zoom: 19,
        altitude: 260,
      }, { duration: 800 });
      return;
    }

    // Se o usuário arrastou o mapa manualmente, paramos de seguir automaticamente
    if (!isFollowingUser && isNavigating && userLocation) {
      // Deixa o usuário navegar livremente se arrastou
    }

    // Lógica para decidir o enquadramento (quais marcadores e linhas devem caber na tela)
    const coordinatesToFit: { latitude: number; longitude: number }[] = [];
    if (userLocation) {
      const uLat = Number(userLocation.latitude);
      const uLng = Number(userLocation.longitude);
      let isNearRoute = true;
      if (mapData?.markers && mapData.markers.length > 0) {
        const firstMarker = mapData.markers[0];
        const distKm = Math.abs(uLat - Number(firstMarker.lat)) * 111;
        if (distKm > 40) isNearRoute = false;
      }
      if (isNearRoute) {
        coordinatesToFit.push({ latitude: uLat, longitude: uLng });
      }
    }
    
    if (effectiveFocusMode === 'full_route') {
      // No modo rota cheia, tenta colocar todos os marcadores e polilinhas na visão
      if (mapData?.markers) {
        mapData.markers.forEach(marker => coordinatesToFit.push({ latitude: Number(marker.lat), longitude: Number(marker.lng) }));
      }
      if (mapData?.polylines) {
        mapData.polylines.forEach(polyline => {
          const decoded = decodePolyline(polyline.encodedPolyline);
          decoded.forEach(coord => coordinatesToFit.push({ latitude: Number(coord.latitude), longitude: Number(coord.longitude) }));
        });
      }
    } else if (effectiveFocusMode === 'waiting_bus') {
      // Quando está aguardando o ônibus no ponto, foca no ponto de embarque e na aproximação
      if (mapData?.markers) {
        const boardingMarker = mapData.markers.find(m => m.type === 'boarding_stop');
        if (boardingMarker) {
          coordinatesToFit.push({ latitude: Number(boardingMarker.lat), longitude: Number(boardingMarker.lng) });
        }
      }
      if (liveBusPosition) {
        coordinatesToFit.push({ latitude: Number(liveBusPosition.lat), longitude: Number(liveBusPosition.lng) });
      }
    } else if (effectiveFocusMode === 'walking_to_stop' || effectiveFocusMode === 'walking_to_destination' || effectiveFocusMode === 'on_bus' || effectiveFocusMode === 'transfer') {
      // Sempre focamos a câmera no trecho atual em andamento
      if (walkSteps && walkSteps.length > 0 && currentStepIndex !== undefined) {
        const currentStep = walkSteps[currentStepIndex];
        if (currentStep && currentStep.polyline) {
          const decoded = decodePolyline(currentStep.polyline);
          decoded.forEach(coord => coordinatesToFit.push({ latitude: Number(coord.latitude), longitude: Number(coord.longitude) }));
        }
      }

      // Se for caminhada até o ponto, inclui explicitamente o ponto de embarque
      if (effectiveFocusMode === 'walking_to_stop' && mapData?.markers) {
        const boardingMarker = mapData.markers.find(m => m.type === 'boarding_stop');
        if (boardingMarker) {
          coordinatesToFit.push({ latitude: Number(boardingMarker.lat), longitude: Number(boardingMarker.lng) });
        }
      }

      // Fallback para polilinha geral de caminhada se o passo estiver sem pontos
      if (coordinatesToFit.length <= 1 && mapData?.polylines) {
        const walkPoly = mapData.polylines.find(p => p.type === 'walk');
        if (walkPoly) {
          const decoded = decodePolyline(walkPoly.encodedPolyline);
          decoded.forEach(coord => coordinatesToFit.push({ latitude: Number(coord.latitude), longitude: Number(coord.longitude) }));
        }
      }
    }
    
    // Aplica o ajuste de visão com proteção para coordenadas inválidas (NaN)
    const isValidCoord = (c: any) => c && typeof c.latitude === 'number' && !isNaN(c.latitude) && isFinite(c.latitude) && typeof c.longitude === 'number' && !isNaN(c.longitude) && isFinite(c.longitude);
    const validCoords = coordinatesToFit.filter(isValidCoord);

    if (validCoords.length >= 1) {
      const uniqueCoords = validCoords.filter((c, i, self) => i === self.findIndex(t => t.latitude === c.latitude && t.longitude === c.longitude));
      fitTimer = setTimeout(() => {
        try {
          if (uniqueCoords.length === 1) {
            mapRef.current?.animateToRegion({ 
              ...uniqueCoords[0], 
              latitudeDelta: 0.0016, 
              longitudeDelta: 0.0016 
            }, 800);
          } else if (uniqueCoords.length > 1) {
            let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
            uniqueCoords.forEach(c => {
              if (c.latitude < minLat) minLat = c.latitude;
              if (c.latitude > maxLat) maxLat = c.latitude;
              if (c.longitude < minLng) minLng = c.longitude;
              if (c.longitude > maxLng) maxLng = c.longitude;
            });

            const diffLat = maxLat - minLat;
            const diffLng = maxLng - minLng;
            const centerLat = (minLat + maxLat) / 2;
            const centerLng = (minLng + maxLng) / 2;

            if (isNavigating) {
              // Navegação ativa em tela cheia (navegando.tsx)
              const isShortWalk = (effectiveFocusMode === 'walking_to_stop' || effectiveFocusMode === 'walking_to_destination') && diffLat < 0.004 && diffLng < 0.004;

              if (isShortWalk) {
                const STREET_MIN_DELTA = 0.0015;
                const latDelta = Math.max(diffLat * 2.2, STREET_MIN_DELTA);
                const lngDelta = Math.max(diffLng * 2.2, STREET_MIN_DELTA);

                // Compensação óptica vertical: o card inferior tem ~260-300px e o topo tem ~160px.
                // Deslocar o centro ligeiramente para o sul traz a rota para o centro da área livre visível.
                const verticalOffsetRatio = Math.max(0, (controlsBottomOffset - 140) / 750);
                const adjustedCenterLat = centerLat - (verticalOffsetRatio * latDelta * 0.45);

                mapRef.current?.animateToRegion({
                  latitude: adjustedCenterLat,
                  longitude: centerLng,
                  latitudeDelta: latDelta,
                  longitudeDelta: lngDelta,
                }, 800);
              } else {
                mapRef.current?.fitToCoordinates(uniqueCoords, { 
                  edgePadding: { 
                    top: 160, 
                    right: 36, 
                    bottom: controlsBottomOffset + 36, 
                    left: 36 
                  }, 
                  animated: true 
                });
              }
            } else {
              // Modo Preview (ex: tela de Melhor Rota em card de 220px)
              if ((effectiveFocusMode === 'walking_to_stop' || effectiveFocusMode === 'walking_to_destination') && diffLat < 0.004 && diffLng < 0.004) {
                const STREET_MIN_DELTA = 0.0015;
                const latDelta = Math.max(diffLat * 2.0, STREET_MIN_DELTA);
                const lngDelta = Math.max(diffLng * 2.0, STREET_MIN_DELTA);

                mapRef.current?.animateToRegion({
                  latitude: centerLat,
                  longitude: centerLng,
                  latitudeDelta: latDelta,
                  longitudeDelta: lngDelta,
                }, 600);
              } else {
                // Enquadramento da rota com margem confortável de 35% no card de preview
                const latDelta = Math.max(diffLat * 1.35, 0.006);
                const lngDelta = Math.max(diffLng * 1.35, 0.006);

                mapRef.current?.animateToRegion({
                  latitude: centerLat,
                  longitude: centerLng,
                  latitudeDelta: latDelta,
                  longitudeDelta: lngDelta,
                }, 600);
              }
            }
          }
        } catch (err) {
          console.warn("[Map] Falha ao ajustar visão:", err);
        }
      }, 400);
    }

    return () => {
      if (fitTimer) clearTimeout(fitTimer);
    };
  }, [mapData, userLocation, userHeading, effectiveFocusMode, controlsBottomOffset, currentStepIndex, walkSteps, isFollowingUser, isNavigating, liveBusPosition]);

  const renderedGeneralPolylines = useMemo(() => {
    if ((walkSteps && walkSteps.length > 0) && effectiveFocusMode !== 'full_route') {
      return [];
    }
    if (!mapData?.polylines) return [];

    return mapData.polylines
      .filter(p => effectiveFocusMode === 'full_route' || p.type === 'walk')
      .map(polyline => {
        const coords = decodePolyline(polyline.encodedPolyline);
        if (coords.length < 2) return null;
        const isWalk = polyline.type === 'walk';
        return {
          id: polyline.id,
          coords,
          strokeColor: isWalk ? '#2563EB' : '#22C55E',
          strokeWidth: isWalk ? 6 : 6,
          lineDashPattern: isWalk ? [0, 16] : undefined,
          baseTrackColor: isWalk 
            ? (colorScheme === 'dark' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(37, 99, 235, 0.16)') 
            : undefined,
          baseTrackWidth: isWalk ? 12 : undefined,
          zIndex: isWalk ? 2 : 1,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [mapData?.polylines, walkSteps, effectiveFocusMode, colorScheme]);

  const renderedWalkStepPolylines = useMemo(() => {
    if (!walkSteps || walkSteps.length === 0 || effectiveFocusMode === 'full_route') {
      return [];
    }

    return walkSteps
      .map((step, index) => {
        const coords = decodePolyline(step.polyline);
        if (coords.length < 2) return null;

        const isActive = index === currentStepIndex;
        const isPast = index < currentStepIndex;
        const isTransit = step.type === 'transit';

        let strokeColor = isTransit ? '#22C55E' : '#2563EB';
        let strokeWidth = isTransit ? 8 : 6;
        let zIndex = 5;
        let lineDashPattern: number[] | undefined = isTransit ? undefined : [0, 16];
        let baseTrackColor: string | undefined = isTransit 
          ? undefined 
          : (colorScheme === 'dark' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(37, 99, 235, 0.16)');
        let baseTrackWidth: number | undefined = isTransit ? undefined : 12;

        if (isPast) {
          strokeColor = '#94A3B8';
          strokeWidth = isTransit ? 6 : 5;
          zIndex = 3;
          lineDashPattern = isTransit ? undefined : [0, 14];
          baseTrackColor = isTransit ? undefined : 'rgba(148, 163, 184, 0.15)';
          baseTrackWidth = isTransit ? undefined : 10;
        } else if (!isActive) {
          strokeColor = isTransit ? 'rgba(34, 197, 94, 0.4)' : 'rgba(37, 99, 235, 0.65)';
          strokeWidth = isTransit ? 6 : 5;
          zIndex = 4;
          lineDashPattern = isTransit ? undefined : [0, 16];
          baseTrackColor = isTransit ? undefined : (colorScheme === 'dark' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.10)');
          baseTrackWidth = isTransit ? undefined : 10;
        }

        return {
          key: `walk-step-${index}`,
          coords,
          strokeColor,
          strokeWidth,
          lineDashPattern,
          baseTrackColor,
          baseTrackWidth,
          zIndex,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [effectiveFocusMode, walkSteps, currentStepIndex, colorScheme]);

  const renderedTurnMarkers = useMemo(() => {
    if (!walkSteps || walkSteps.length === 0 || effectiveFocusMode === 'full_route') {
      return [];
    }

    return walkSteps
      .map((step, index) => {
        if (!step.endLocation || index === walkSteps.length - 1) return null;
        const isPast = index < currentStepIndex;
        if (isPast) return null;

        return {
          key: `turn-${index}`,
          latitude: Number(step.endLocation.lat),
          longitude: Number(step.endLocation.lng),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [effectiveFocusMode, walkSteps, currentStepIndex]);

  const renderedMainMarkers = useMemo(() => {
    if (!mapData?.markers) return [];

    return mapData.markers
      .filter(m => {
        if (!m) return false;
        const lat = Number(m.lat);
        const lng = Number(m.lng);
        if (isNaN(lat) || !isFinite(lat) || isNaN(lng) || !isFinite(lng)) return false;
        if (m.type === 'user') return false;
        if (effectiveFocusMode === 'full_route') return true;
        return m.type === 'boarding_stop';
      })
      .map((marker, idx) => ({
        id: `${marker.id || 'marker'}-${idx}`,
        latitude: Number(marker.lat),
        longitude: Number(marker.lng),
        title: marker.title || '',
        description: marker.description || '',
        type: marker.type,
        pinColor: getMarkerColor(marker.type),
      }));
  }, [mapData?.markers, effectiveFocusMode]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        followsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        loadingEnabled={true}
        loadingBackgroundColor={theme.background}
        customMapStyle={Platform.OS === 'android' ? (colorScheme === 'dark' ? darkMapStyle : cleanMapStyle) : undefined}
        userLocationAnnotationTitle=""
        mapPadding={{ top: 0, right: 0, left: 0, bottom: controlsBottomOffset }}
        onPanDrag={() => {
          if (isFollowingUser) setIsFollowingUser(false);
        }}
      >
        {/* Renderização de Rota Geral (Full Route ou Fallback Walk) */}
        {renderedGeneralPolylines.map((item) => (
          <React.Fragment key={item.id}>
            {item.baseTrackColor && (
              <Polyline
                coordinates={item.coords}
                strokeColor={item.baseTrackColor}
                strokeWidth={item.baseTrackWidth || 10}
                zIndex={item.zIndex - 1}
                lineCap="round"
                lineJoin="round"
              />
            )}
            <Polyline
              coordinates={item.coords}
              strokeColor={item.strokeColor}
              strokeWidth={item.strokeWidth}
              lineDashPattern={item.lineDashPattern}
              zIndex={item.zIndex}
              lineCap="round"
              lineJoin="round"
            />
          </React.Fragment>
        ))}

        {/* Renderização Guiada de Passos de Caminhada */}
        {renderedWalkStepPolylines.map((item) => (
          <React.Fragment key={item.key}>
            {item.baseTrackColor && (
              <Polyline
                coordinates={item.coords}
                strokeColor={item.baseTrackColor}
                strokeWidth={item.baseTrackWidth || 10}
                zIndex={item.zIndex - 1}
                lineCap="round"
                lineJoin="round"
              />
            )}
            <Polyline
              coordinates={item.coords}
              strokeColor={item.strokeColor}
              strokeWidth={item.strokeWidth}
              lineDashPattern={item.lineDashPattern}
              zIndex={item.zIndex}
              lineCap="round"
              lineJoin="round"
            />
          </React.Fragment>
        ))}

        {/* Marcadores de Virada */}
        {renderedTurnMarkers.map((turn) => (
          <Marker
            key={turn.key}
            coordinate={{ latitude: turn.latitude, longitude: turn.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            flat={true}
            zIndex={10}
          >
            <View style={[styles.turnDot, { backgroundColor: 'white', borderColor: theme.primary }]} />
          </Marker>
        ))}

        {/* Marcadores Principais */}
        {renderedMainMarkers.map((marker) => {
          const isBoardingStop = marker.type === 'boarding_stop';

          return (
            <Marker
              key={marker.id}
              coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
              title={isBoardingStop ? undefined : marker.title}
              description={isBoardingStop ? undefined : marker.description}
              pinColor={isBoardingStop ? undefined : marker.pinColor}
              anchor={isBoardingStop ? { x: 0.5, y: 1.0 } : undefined}
              zIndex={20}
              accessibilityLabel={`Ponto: ${marker.title || 'Ponto de Embarque'}`}
            >
              {isBoardingStop ? (
                <View style={styles.modernStopPinContainer}>
                  {/* Badge Flutuante com Nome do Ponto */}
                  {isWaitingBus ? (
                    <View style={styles.waitingStopBadge}>
                      <View style={styles.waitingStopBadgeDot} />
                      <Text style={styles.waitingStopBadgeText}>Seu Ponto</Text>
                    </View>
                  ) : (
                    <View style={[
                      styles.modernStopBadge, 
                      isNavigating 
                        ? styles.modernStopBadgeNavigating 
                        : { backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#FFFFFF' }
                    ]}>
                      <View style={[styles.modernStopBadgeDot, isNavigating && styles.modernStopBadgeDotNavigating]} />
                      <Text 
                        style={[
                          styles.modernStopBadgeText, 
                          isNavigating ? styles.modernStopBadgeTextNavigating : { color: colorScheme === 'dark' ? '#F1F5F9' : '#0F172A' }
                        ]} 
                        numberOfLines={1}
                      >
                        {isNavigating ? 'Embarque' : (marker.title || 'Ponto de Embarque')}
                      </Text>
                    </View>
                  )}

                  {/* Pin Circular com Ícone de Alvo no WaitingBus ou Ônibus no Walking */}
                  <View style={[styles.modernStopPinCircle, isWaitingBus && styles.waitingStopPinCircle]}>
                    <MaterialCommunityIcons 
                      name={isWaitingBus ? "crosshairs-gps" : "bus"} 
                      size={isWaitingBus ? 22 : 19} 
                      color="#FFFFFF" 
                    />
                  </View>

                  {/* Ponta da Agulha do Pin */}
                  <View style={styles.modernStopPinTip} />

                  {/* Sombra de Contato com o Solo */}
                  <View style={styles.modernStopGroundShadow} />
                </View>
              ) : null}

              <Callout>
                <View style={[styles.callout, { backgroundColor: theme.card }]}>
                  <Text style={[styles.calloutTitle, { color: theme.text }]}>
                    {marker.title || 'Ponto de Embarque'}
                  </Text>
                  {!!marker.description && (
                    <Text style={[styles.calloutDesc, { color: theme.textMuted }]}>
                      {marker.description}
                    </Text>
                  )}
                </View>
              </Callout>
            </Marker>
          );
        })}

        {/* Marcador do Ônibus (Ao Vivo ou Aproximação no Waiting Bus) */}
        {(liveBusPosition || (isWaitingBus && mapData?.markers?.find(m => m.type === 'boarding_stop'))) && (() => {
          const boardingStop = mapData?.markers?.find(m => m.type === 'boarding_stop');
          const busPos = liveBusPosition || {
            lat: (boardingStop ? Number(boardingStop.lat) : -19.7472) - 0.0003,
            lng: (boardingStop ? Number(boardingStop.lng) : -47.9392) - 0.0014,
            heading: 85
          };

          return (
            <Marker
              key="live-bus-marker"
              coordinate={{ latitude: busPos.lat, longitude: busPos.lng }}
              zIndex={30}
              anchor={{ x: 0.5, y: 0.5 }}
              flat={true}
              rotation={busPos.heading || 0}
            >
              <View style={styles.busMarkerContainer}>
                <View style={styles.busMarkerBadge}>
                  <Text style={styles.busMarkerBadgeText}>{busLine ? `Linha ${busLine}` : 'Linha 31'}</Text>
                  <View style={styles.busMarkerBadgeDot} />
                </View>
                <View style={styles.busMarkerCircle}>
                  <MaterialCommunityIcons name="bus" size={19} color="#FFFFFF" />
                </View>
              </View>
            </Marker>
          );
        })()}
      </MapView>
      {!hideControls && (
        <View style={[styles.controls, { bottom: controlsBottomOffset + 18 }]} pointerEvents="box-none">
          <TouchableOpacity 
            style={[
              styles.floatingCircleBtn, 
              colorScheme === 'dark' ? styles.floatingCircleBtnDark : styles.floatingCircleBtnLight
            ]} 
            onPress={handleRecenter} 
            activeOpacity={0.7}
            accessibilityLabel="Centralizar minha localização"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="crosshairs-gps" size={22} color="#007AFF" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.floatingCircleBtn, 
              colorScheme === 'dark' ? styles.floatingCircleBtnDark : styles.floatingCircleBtnLight
            ]} 
            onPress={toggleFocusMode} 
            activeOpacity={0.7}
            accessibilityLabel={effectiveFocusMode === 'full_route' ? "Focar no ponto" : "Ver rota completa"}
            accessibilityRole="button"
          >
            <Ionicons name="layers-outline" size={22} color={colorScheme === 'dark' ? '#D1D5DB' : '#374151'} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  map: { width: '100%', height: '100%' },
  controls: { 
    position: 'absolute', 
    right: 16, 
    gap: 12,
    zIndex: 100 
  },
  floatingCircleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingCircleBtnLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
  },
  floatingCircleBtnDark: {
    backgroundColor: 'rgba(25, 28, 34, 0.90)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  controlGroup: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 2,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  controlButton: {
    width: 42,
    height: 42,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: 1,
    height: 20,
    marginHorizontal: 4,
  },
  modernStopPinContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 2,
  },
  modernStopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 12,
    marginBottom: 4,
    maxWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  modernStopBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
    marginRight: 5,
  },
  modernStopBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modernStopBadgeNavigating: {
    backgroundColor: '#0066FF',
    borderColor: '#FFFFFF',
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginBottom: 5,
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 5,
  },
  modernStopBadgeDotNavigating: {
    backgroundColor: '#FFFFFF',
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  modernStopBadgeTextNavigating: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  modernStopPinCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
  },
  modernStopPinTip: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 0,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#2563EB',
    marginTop: -1,
  },
  modernStopGroundShadow: {
    width: 14,
    height: 4,
    borderRadius: 7,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    marginTop: 2,
  },
  liveBusMarker: {
    backgroundColor: '#F59E0B',
    padding: 6,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 8,
  },
  turnDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  callout: { padding: 10, minWidth: 140, borderRadius: 12 },
  calloutTitle: { fontWeight: '800', fontSize: 15 },
  calloutDesc: { fontSize: 13, marginTop: 2 },
  waitingStopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 14,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  waitingStopBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  waitingStopBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  waitingStopPinCircle: {
    backgroundColor: '#007AFF',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 8,
  },
  busMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  busMarkerBadge: {
    backgroundColor: '#111827',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 5,
  },
  busMarkerBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  busMarkerBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  busMarkerCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
  },
});

export default Map;
