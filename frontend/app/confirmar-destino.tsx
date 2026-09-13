import { BackgroundGradient } from "../src/components/BackgroundGradient";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  useColorScheme,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker } from "react-native-maps";
import Animated, { FadeIn, FadeInUp, useAnimatedScrollHandler, useSharedValue, useAnimatedStyle, interpolate, Extrapolation } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackButton } from "../src/components/BackButton";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { DestinationCategoryIcon } from "../src/components/DestinationCategoryIcon";
import { useAutoSpeakOnce } from "../src/hooks/useAutoSpeakOnce";
import { useThemeColors } from "../src/theme/colors";
import { LiquidGlassView } from "../src/components/LiquidGlassView";
import { usePreventDoublePress } from "../src/hooks/usePreventDoublePress";
import { LinearGradient } from "expo-linear-gradient";

import { vibrationService } from "../src/services/vibration.service";
import { parseJsonParam } from "../src/utils/helpers";
import { layout } from "../src/theme/layout";
import {
  getDestinationCategoryLabel,
  resolveDestinationCategory,
} from "../src/utils/destinationCategory.mapper";

function getSingleParam(value: string | string[] | undefined, fallback = "") {
  return Array.isArray(value)
    ? String(value[0] || fallback)
    : String(value || fallback);
}

function parseRequiredCoordinate(value: string) {
  if (!value || value === "null" || value === "undefined") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const getAddressDetails = (addr: string) => {
  const parts = addr
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    main: parts.slice(0, 2).join(", ") || addr || "Endereço não informado",
    area: parts.slice(2).join(", "),
  };
};



const CarouselCardItem = ({
  option,
  index,
  optionsLength,
  currentSuggestionIndex,
  handleSelectSuggestion,
  isActionDisabled,
  carouselCardWidth,
  cardMinHeight,
  city,
  theme,
  scrollX,
}: any) => {
  const isDark = useColorScheme() === 'dark';
  const isCurrent = index === currentSuggestionIndex;
  const optionCategory = resolveDestinationCategory(option);
  const addressDetails = getAddressDetails(option.address || "");
  const hasCoordinates =
    parseRequiredCoordinate(String(option.lat ?? "")) !== null &&
    parseRequiredCoordinate(String(option.lng ?? "")) !== null;

  const itemWidth = carouselCardWidth + 12;

  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * itemWidth,
      index * itemWidth,
      (index + 1) * itemWidth,
    ];
    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.9, 1, 0.9],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.5, 1, 0.5],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 80).duration(300)}
      style={[{ width: carouselCardWidth }, animatedStyle]}
    >
      <Pressable
        style={({ pressed }) => [
          styles.destCard,
          { minHeight: cardMinHeight, padding: 0, overflow: 'hidden', borderWidth: isCurrent ? 2 : 1, borderColor: isCurrent ? '#3B82F6' : (isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'), borderRadius: 24 },
          isCurrent && styles.destCardActive,
          isDark && {
            backgroundColor: isCurrent ? 'rgba(30, 41, 59, 1)' : 'rgba(30, 41, 59, 0.75)',
            borderColor: isCurrent ? '#3B82F6' : 'rgba(255, 255, 255, 0.12)',
          },
          (pressed || isActionDisabled) && { opacity: 0.8, transform: [{ scale: 0.99 }] }]}
        disabled={isActionDisabled}
        onPress={() => handleSelectSuggestion(option, index)}
        accessibilityRole="button"
        accessibilityLabel={`Selecionar ${index + 1}: ${option.name}, ${option.address}`}
      >
        <View style={{ flex: 1 }}>
          {/* Mapa Snapshot no topo */}
          <View style={{ height: 140, width: '100%', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9', position: 'relative' }}>
            {hasCoordinates ? (
              <MapView
                style={StyleSheet.absoluteFillObject}
                initialRegion={{
                  latitude: Number(option.lat),
                  longitude: Number(option.lng),
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
                pitchEnabled={false}
                rotateEnabled={false}
                scrollEnabled={false}
                zoomEnabled={false}
                pointerEvents="none"
              >
                <Marker coordinate={{ latitude: Number(option.lat), longitude: Number(option.lng) }}>
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#3B82F6', borderWidth: 2, borderColor: '#fff' }} />
                </Marker>
              </MapView>
            ) : (
              <View style={[StyleSheet.absoluteFillObject, { justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="map-outline" size={32} color={theme.textMuted} />
              </View>
            )}
            
            {/* Overlay: Badge Opção (Top Left) e Ponto Confirmado (Top Right) */}
            <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: isCurrent ? '#3B82F6' : '#fff', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }}>
               <Text style={{ fontSize: 12, fontWeight: '800', color: isCurrent ? '#fff' : '#0F172A' }}>Opção {index + 1} de {optionsLength}</Text>
               {isCurrent && <Ionicons name="checkmark-circle" size={14} color="#fff" style={{ marginLeft: 6 }} />}
            </View>

            <View style={{ position: 'absolute', top: 12, right: 12, backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }}>
               <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: hasCoordinates ? '#10B981' : '#F59E0B', marginRight: 6 }} />
               <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A' }}>{hasCoordinates ? "Confirmado" : "Pendente"}</Text>
            </View>

            <View style={{ position: 'absolute', bottom: 12, left: 12, backgroundColor: '#1E293B', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center' }}>
               <Ionicons name="location" size={12} color="#fff" />
               <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff', marginLeft: 4 }}>{city}</Text>
            </View>
          </View>

          <View style={{ padding: 20 }}>
            {/* Ícone e Nome */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF', justifyContent: 'center', alignItems: 'center' }}>
                <DestinationCategoryIcon category={optionCategory} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 2 }} numberOfLines={1}>
                  {option.name}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '500', color: theme.textMuted }} numberOfLines={1}>
                  {addressDetails.main}
                </Text>
                {!!addressDetails.area && (
                  <Text style={{ fontSize: 13, fontWeight: '400', color: theme.textMuted, marginTop: 2 }} numberOfLines={1}>
                    {addressDetails.area}
                  </Text>
                )}
              </View>
            </View>

            {/* Divisor */}
            <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0', marginVertical: 16 }} />

            {/* Validação */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Ionicons name="business-outline" size={18} color={theme.textMuted} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textMuted }} numberOfLines={1}>{city}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#3B82F6' }}>{getDestinationCategoryLabel(optionCategory)}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                  <Ionicons name="checkmark" size={14} color="#10B981" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#10B981', marginLeft: 4 }}>Validado</Text>
                </View>
              </View>
            </View>
            
            {/* Aviso (Opcional no carrossel, mostra se selecionado) */}
            {isCurrent && (
              <View style={{ flexDirection: 'row', backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#FFFBEB', borderColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7', borderWidth: 1, borderRadius: 12, padding: 12 }}>
                <Ionicons name="alert-circle" size={18} color="#D97706" style={{ marginTop: 2 }} />
                <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: "#D97706", marginLeft: 8, lineHeight: 18 }}>
                  Confira o número predial e referências próximas antes de iniciar o deslocamento.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

export default function ConfirmDestinationScreen() {
  const params = useLocalSearchParams();
  const theme = useThemeColors();
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();

  const isSmallHeight = height < 740;
  const screenHorizontalPadding = isSmallHeight
    ? layout.screenHorizontalPaddingSmall
    : layout.screenHorizontalPadding;
  const singleCardWidth = width - screenHorizontalPadding * 2;
  const carouselCardWidth = singleCardWidth - 32;
  const usableHeight = height - insets.top - insets.bottom;

  const maxPercent = 0.60;
  const maxHeight = 540;
  const minAbsolute = 360;
  const cardMinHeight = Math.max(minAbsolute, Math.min(usableHeight * maxPercent, maxHeight));

  const latitude = getSingleParam(params.latitude);
  const longitude = getSingleParam(params.longitude);
  const destination = getSingleParam(params.destination);
  const address = getSingleParam(params.address);
  const city = getSingleParam(params.city, "Uberaba - MG");
  const backendMode = getSingleParam(params.mode);
  const isVoiceSearch = getSingleParam(params.isVoiceSearch, "false");

  const [sessionId] = useState(getSingleParam(params.sessionId));
  const [displayData] = useState<any>(() =>
    parseJsonParam(params.displayData, null),
  );
  const [conversationState] = useState(getSingleParam(params.conversationState));
  const [isLoadingCommand, setIsLoadingCommand] = useState(false);
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);

  const rawOptions = parseJsonParam<any[]>(params.options, []);
  const options = (
    rawOptions.length > 0 ? rawOptions : displayData?.items || []
  ).map((item: any, index: number) => {
    const rawMatch = rawOptions[index] || {};
    return {
      ...item,
      lat: item.lat ?? rawMatch.lat ?? null,
      lng: item.lng ?? rawMatch.lng ?? null,
      id: item.id ?? rawMatch.id ?? String(index),
    };
  });

  const bestOption = useMemo(() => options[0] || {}, [options]);
  const isGeneric = bestOption.isGenericCityResult;
  const confidence = bestOption.confidence || "high";
  const showSuggestions =
    conversationState === "WAITING_DESTINATION_SELECTION" ||
    backendMode === "suggestions" ||
    (isGeneric && options.length > 1) ||
    confidence === "low";
  const selectedSuggestion: any = null;
  const isChoosingSuggestion = showSuggestions;

  const displayDestination =
    bestOption.name || displayData?.title || destination || "Destino informado";



  const activeDestinationName =
    selectedSuggestion?.name || bestOption.name || displayDestination;
  const activeDestinationAddress =
    selectedSuggestion?.address || bestOption.address || address;
  const activeDestination = selectedSuggestion || bestOption;
  const activeDestinationCategory = resolveDestinationCategory({
    ...activeDestination,
    name: activeDestinationName,
    address: activeDestinationAddress,
  });
  const activeAddressDetails = getAddressDetails(activeDestinationAddress || "");
  const activeHasCoordinates =
    parseRequiredCoordinate(String(activeDestination?.lat ?? "")) !== null &&
    parseRequiredCoordinate(String(activeDestination?.lng ?? "")) !== null;

  const isActionDisabled = isLoadingCommand;

  const scrollX = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  // ─── TTS automático: anuncia o destino encontrado ─────────────────────
  const destinationSpeechText = (() => {
    if (showSuggestions) {
      return `Encontrei esses destinos. Selecione o desejado e toque em buscar rota.`;
    }
    if (activeDestinationName) {
      return `Encontrei esse destino: ${activeDestinationName}. Se for esse, toque em buscar rota.`;
    }
    return "";
  })();
  useAutoSpeakOnce(
    showSuggestions
      ? `confirm-dest-suggestions-${sessionId}-${options.length}`
      : `confirm-dest-${sessionId}-${activeDestinationName}`,
    destinationSpeechText,
    isVoiceSearch === "true"
  );

  const navigateWithSelectedDestination = useCallback(
    (selected: any) => {
      const originLat = parseRequiredCoordinate(latitude);
      const originLng = parseRequiredCoordinate(longitude);
      const destLat = parseRequiredCoordinate(String(selected.lat ?? ""));
      const destLng = parseRequiredCoordinate(String(selected.lng ?? ""));

      if (originLat === null || originLng === null) {
        vibrationService.error();
        Alert.alert(
          "Localização de origem ausente",
          "Não consegui identificar sua localização atual. Volte ao início e tente novamente.",
          [{ text: "OK", onPress: () => router.replace("/inicio") }],
        );
        return;
      }

      if (destLat === null || destLng === null) {
        vibrationService.error();
        Alert.alert(
          "Localização não encontrada",
          "Não consegui confirmar a localização desse destino. Tente escolher outra opção.",
          [{ text: "OK" }],
        );
        return;
      }

      router.push({
        pathname: "/escolher-horario",
        params: {
          latitude: String(originLat),
          longitude: String(originLng),
          destination: selected.name || displayDestination,
          destinationLat: String(destLat),
          destinationLng: String(destLng),
          selectedDestination: JSON.stringify(selected),
          sessionId,
          isVoiceSearch,
        },
      });
    },
    [displayDestination, latitude, longitude, sessionId, isVoiceSearch],
  );

  const handleSelectSuggestion = useCallback(
    (option: any, index: number) => {
      if (!option) return;
      vibrationService.selection();
      setCurrentSuggestionIndex(index);
    },
    [],
  );

  const handleConfirmDestination = usePreventDoublePress(async (option?: any) => {
    const selected = option || selectedSuggestion || bestOption;

    if (showSuggestions && !selectedSuggestion && !option) {
      vibrationService.light();
      return;
    }

    if (!selected || Object.keys(selected).length === 0) {
      vibrationService.error();
      Alert.alert(
        "Destino não encontrado",
        "Não recebi os dados do destino. Escolha outro destino e tente novamente.",
      );
      return;
    }

    setIsLoadingCommand(true);
    if (option || selectedSuggestion) {
      vibrationService.selection();
    } else {
      vibrationService.success();
    }

    try {
      navigateWithSelectedDestination(selected);
    } finally {
      setIsLoadingCommand(false);
    }
  });

  const handlePrimaryAction = usePreventDoublePress(async () => {
    if (isChoosingSuggestion) {
      const currentOption = options[currentSuggestionIndex];
      if (!currentOption) return;
      handleSelectSuggestion(currentOption, currentSuggestionIndex);
      await handleConfirmDestination(currentOption);
      return;
    }
    await handleConfirmDestination();
  });

  const handleHelp = () => router.push("/ajuda");

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <BackgroundGradient />
      {/* TOP BAR — Floating Glass Pills */}
      <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.topBarInner} pointerEvents="box-none">
          <BackButton label="Voltar" accessibilityLabel="Voltar para a tela anterior" />
          <Pressable
            style={({ pressed }) => [
              pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }
            ]}
            onPress={handleHelp}
            accessibilityLabel="Abrir ajuda"
            accessibilityRole="button"
          >
            <LiquidGlassView
              style={[
                styles.glassPill,
                isDark
                  ? { backgroundColor: "rgba(15, 23, 42, 0.3)", borderColor: "rgba(255, 255, 255, 0.15)" }
                  : { backgroundColor: "rgba(255, 255, 255, 0.2)", borderColor: "rgba(255, 255, 255, 0.4)" }
              ]}
              fallbackColor={theme.card}
            >
              <Ionicons name="help-circle" size={18} color={theme.text} />
              <Text style={[styles.glassPillText, { color: theme.text }]}>Ajuda</Text>
            </LiquidGlassView>
          </Pressable>
        </View>
      </View>

      {/* SCROLL */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + (isSmallHeight ? 64 : 82),
            paddingBottom: insets.bottom + 112,
          }]}
      >
        <Animated.View 
          entering={FadeIn.duration(400)} 
          style={{ flex: 1 }}
        >

          {/* Título + subtítulo — centralizado com mais respiro no topo */}
          <View style={[styles.header, { paddingHorizontal: screenHorizontalPadding, marginTop: isSmallHeight ? 8 : 16 }]}>
            <Text style={[styles.title, { color: theme.text }]} maxFontSizeMultiplier={1.2}>
              {showSuggestions ? "Destinos encontrados" : "Destino encontrado"}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]} maxFontSizeMultiplier={1.1}>
              {isChoosingSuggestion
                ? `${options.length} ${options.length === 1 ? "opção" : "opções"} para escolher`
                : `Confira os dados do local antes de prosseguir`}
            </Text>
          </View>

          {isChoosingSuggestion ? (
            /* ── CARROSSEL (Edge-to-Edge sem cortes laterais) ── */
            <View style={styles.carouselWrapper}>
              <Animated.ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={carouselCardWidth + 12}
                decelerationRate="fast"
                contentContainerStyle={[
                  styles.carouselContent,
                  { paddingHorizontal: screenHorizontalPadding }
                ]}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                onMomentumScrollEnd={(event) => {
                  const offsetX = event.nativeEvent.contentOffset.x;
                  const nextIndex = Math.round(offsetX / (carouselCardWidth + 12));
                  setCurrentSuggestionIndex(
                    Math.max(0, Math.min(nextIndex, options.length - 1)),
                  );
                }}
                accessibilityLabel="Destinos encontrados em carrossel"
              >
                {options.map((option: any, index: number) => (
                  <CarouselCardItem
                    key={option.id || index}
                    option={option}
                    index={index}
                    optionsLength={options.length}
                    currentSuggestionIndex={currentSuggestionIndex}
                    handleSelectSuggestion={(opt: any, idx: number) => {
                      handleSelectSuggestion(opt, idx);
                      handleConfirmDestination(opt);
                    }}
                    isActionDisabled={isActionDisabled}
                    carouselCardWidth={carouselCardWidth}
                    cardMinHeight={cardMinHeight}
                    city={city}
                    theme={theme}
                    scrollX={scrollX}
                  />
                ))}
              </Animated.ScrollView>

              {options.length > 1 && (
                <View style={styles.carouselDots}>
                  {options.map((_: any, index: number) => (
                    <View
                      key={index}
                      style={[
                        styles.carouselDot,
                        index === currentSuggestionIndex && {
                          backgroundColor: theme.primary,
                          width: 18,
                        }]}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            /* ── CARD ÚNICO (Design Figma Snapshot) ── */
            <Animated.View
              entering={FadeInUp.delay(150).duration(400)}
              style={[
                styles.destCard,
                { padding: 0, overflow: 'hidden', width: singleCardWidth, alignSelf: "center", borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0', borderRadius: 24 },
                isDark && {
                  backgroundColor: 'rgba(30, 41, 59, 1)',
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                }]}
            >
              {/* Mapa Snapshot no topo */}
              <View style={{ height: 140, width: '100%', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9', position: 'relative' }}>
                {activeHasCoordinates ? (
                  <MapView
                    style={StyleSheet.absoluteFillObject}
                    initialRegion={{
                      latitude: Number(activeDestination.lat),
                      longitude: Number(activeDestination.lng),
                      latitudeDelta: 0.005,
                      longitudeDelta: 0.005,
                    }}
                    pitchEnabled={false}
                    rotateEnabled={false}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    pointerEvents="none"
                  >
                    <Marker coordinate={{ latitude: Number(activeDestination.lat), longitude: Number(activeDestination.lng) }}>
                      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#3B82F6', borderWidth: 2, borderColor: '#fff' }} />
                    </Marker>
                  </MapView>
                ) : (
                  <View style={[StyleSheet.absoluteFillObject, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="map-outline" size={32} color={theme.textMuted} />
                  </View>
                )}
                
                {/* Overlays do mapa */}
                <View style={{ position: 'absolute', top: 12, right: 12, backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }}>
                   <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 6 }} />
                   <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A' }}>Ponto confirmado</Text>
                </View>

                <View style={{ position: 'absolute', bottom: 12, left: 12, backgroundColor: '#1E293B', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center' }}>
                   <Ionicons name="location" size={12} color="#fff" />
                   <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff', marginLeft: 4 }}>{city}</Text>
                </View>
              </View>

              <View style={{ padding: 20 }}>
                {/* Ícone e Nome */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF', justifyContent: 'center', alignItems: 'center' }}>
                    <DestinationCategoryIcon category={activeDestinationCategory} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 2 }} numberOfLines={1}>
                      {activeDestinationName}
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: theme.textMuted }} numberOfLines={1}>
                      {activeAddressDetails.main}
                    </Text>
                    {!!activeAddressDetails.area && (
                      <Text style={{ fontSize: 13, fontWeight: '400', color: theme.textMuted, marginTop: 2 }} numberOfLines={1}>
                        {activeAddressDetails.area}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Divisor */}
                <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0', marginVertical: 16 }} />

                {/* Validação */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Ionicons name="business-outline" size={18} color={theme.textMuted} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textMuted }} numberOfLines={1}>{city}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#3B82F6' }}>{getDestinationCategoryLabel(activeDestinationCategory)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                      <Ionicons name="checkmark" size={14} color="#10B981" />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#10B981', marginLeft: 4 }}>Validado</Text>
                    </View>
                  </View>
                </View>

                {/* Alerta */}
                <View style={{ flexDirection: 'row', backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#FFFBEB', borderColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 20 }}>
                  <Ionicons name="alert-circle" size={18} color="#D97706" style={{ marginTop: 2 }} />
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: "#D97706", marginLeft: 8, lineHeight: 18 }}>
                    Confira o número predial e referências próximas antes de iniciar o deslocamento.
                  </Text>
                </View>

                {/* Botões secundários */}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Pressable style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#E2E8F0' }, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
                    <Ionicons name="pencil-outline" size={18} color={theme.text} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>Alterar</Text>
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          )}

        </Animated.View>
      </ScrollView>

      {/* BOTÕES FIXOS — idêntico ao rodapé da rota pronta */}
      <View style={styles.fixedBottomActionsShadow}>
        <View style={[styles.fixedBottomActionsContent, { paddingBottom: insets.bottom + 16 }]}>
          <LiquidGlassView style={StyleSheet.absoluteFillObject} fallbackColor={theme.card} />
          <LinearGradient
            colors={['transparent', theme.background]}
            locations={[0.2, 1]}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <PrimaryButton
            title="Buscar rota"
            onPress={handlePrimaryAction}
            isLoading={isLoadingCommand}
            disabled={isActionDisabled}
            style={styles.mainButton}
            accessibilityLabel={
              isChoosingSuggestion
                ? "Buscar rota para o destino selecionado"
                : "Buscar rota"
            }
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ─── Layout base ────────────────────────────────────────────────────
  screen: {
    flex: 1,
  },
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 50,
  },
  topBarInner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 40,
  },
  glassPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  glassPillText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.2,
  },

  // ─── ScrollView (idêntico ao padrão de melhor-rota) ─────────────────
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 20,
    gap: 12,
  },

  // ─── Header centralizado ─────────────────────────────────────────────
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 17,
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
  },

  // ─── VoiceVisualizer ────────────────────────────────────────────────
  visualizerWrapper: {
    alignItems: "center",
    marginBottom: 2,
  },

  // ─── Carrossel ──────────────────────────────────────────────────────
  carouselWrapper: {
    width: "100%",
  },
  carouselContent: {
    gap: 12,
    paddingBottom: 4,
  },
  carouselDots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
  },
  carouselDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#CBD5E1",
  },

  destCard: {
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderRadius: 28,
    padding: 22,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.95)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    justifyContent: "space-between",
  },
  destCardActive: {
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.20,
    shadowRadius: 20,
    elevation: 8,
    borderColor: "#3B82F6",
    backgroundColor: "#FFFFFF",
  },

  cardContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  cardBody: {
    flex: 1,
    justifyContent: "center",
    gap: 20,
    paddingVertical: 8,
  },
  chipsContainer: {
    paddingTop: 16,
  },

  // ─── Linha contador ─────────────────────────────────────────────────
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  numberBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  numberBadgeText: {
    fontSize: 17,
    fontWeight: "900",
  },
  cardCountText: {
    flex: 1,
    color: "#64748B",
    fontSize: 15,
    fontWeight: "700",
  },

  // ─── Ícone + nome ────────────────────────────────────────────────────
  cardPlaceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  placeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  placeTextBox: {
    flex: 1,
  },
  placeName: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 4,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  placeType: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748B",
  },

  // ─── Detalhes de endereço ────────────────────────────────────────────
  cardDetails: {
    gap: 14,
  },
  cardDetailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  cardDetailText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#334155",
    lineHeight: 18,
  },

  // ─── Chips ───────────────────────────────────────────────────────────
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.1)",
  },
  chipText: {
    color: "#1D4ED8",
    fontSize: 13,
    fontWeight: "700",
  },

  // ─── Badge ───────────────────────────────────────────────────────────
  statusBox: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  statusBoxWarning: {
    backgroundColor: "rgba(245,158,11,0.06)",
  },
  statusDesc: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  },

  // ─── Rodapé fixo (idêntico ao de melhor-rota) ────────────────────────
  fixedBottomActionsShadow: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 10,
  },
  fixedBottomActionsContent: {
    paddingTop: 10,
    paddingHorizontal: 26,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "hidden",
    gap: 10,
    minHeight: 100, // To ensure background stretches down safely
  },
  mainButton: {
    borderRadius: 30,
  },
  secondaryWrapper: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  secondaryBtn: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 20,
    backgroundColor: "#EEF2FF",
  },
  secondaryBtnText: {
    color: "#3730A3",
    fontSize: 16,
    fontWeight: "700",
  },
  bottomMicHelper: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
    marginTop: 8,
  },
});
