import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  useColorScheme,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../theme/colors";
import { vibrationService } from "../services/vibration.service";
import { logUserInteraction } from "../utils/devLogger";
import { MarqueeText } from "./MarqueeText";
import type { FormattedRecentSearch } from "../services/recentSearch.service";

interface RecentSearchTickerProps {
  items: FormattedRecentSearch[];
  onSelectItem: (item: FormattedRecentSearch) => void;
  intervalMs?: number;
  testID?: string;
}

export function RecentSearchTicker({
  items,
  onSelectItem,
  intervalMs = 7000,
  testID = "recent-search-ticker",
}: RecentSearchTickerProps) {
  const theme = useThemeColors();
  const isDark = useColorScheme() === "dark";

  // Dois slots independentes: a troca de papéis elimina 100% qualquer piscada
  const [slotA, setSlotA] = useState<FormattedRecentSearch>(
    items[0] || ({} as FormattedRecentSearch)
  );
  const [slotB, setSlotB] = useState<FormattedRecentSearch>(
    items[1] || items[0] || ({} as FormattedRecentSearch)
  );

  const [currentSlot, setCurrentSlot] = useState<"A" | "B">("A");
  const activeSlotRef = useRef<"A" | "B">("A");
  const nextItemIndexRef = useRef(1);
  const isAnimatingRef = useRef(false);

  // Valores de animação do Slot A
  const yA = useRef(new Animated.Value(0)).current;
  const opA = useRef(new Animated.Value(1)).current;

  // Valores de animação do Slot B
  const yB = useRef(new Animated.Value(44)).current;
  const opB = useRef(new Animated.Value(0)).current;

  // Sincroniza se os items mudarem
  useEffect(() => {
    if (items.length > 0) {
      setSlotA(items[0]);
      if (items.length > 1) {
        setSlotB(items[1]);
        nextItemIndexRef.current = 1;
      }
      activeSlotRef.current = "A";
      setCurrentSlot("A");
      yA.setValue(0);
      opA.setValue(1);
      yB.setValue(44);
      opB.setValue(0);
    }
  }, [items]);

  useEffect(() => {
    if (items.length <= 1) {
      return;
    }

    const timer = setInterval(() => {
      if (isAnimatingRef.current) return;
      isAnimatingRef.current = true;

      const nextIndex = nextItemIndexRef.current % items.length;
      const incomingItem = items[nextIndex];

      if (activeSlotRef.current === "A") {
        // Prepara Slot B enquanto invisível
        setSlotB(incomingItem);
        yB.setValue(44);
        opB.setValue(0);

        // Desliza A para cima e B para o centro
        Animated.parallel([
          Animated.timing(yA, {
            toValue: -44,
            duration: 450,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true,
          }),
          Animated.timing(opA, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(yB, {
            toValue: 0,
            duration: 450,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true,
          }),
          Animated.timing(opB, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished) {
            yA.setValue(44);
            activeSlotRef.current = "B";
            setCurrentSlot("B");
            nextItemIndexRef.current = (nextIndex + 1) % items.length;
          }
          isAnimatingRef.current = false;
        });
      } else {
        // Prepara Slot A enquanto invisível
        setSlotA(incomingItem);
        yA.setValue(44);
        opA.setValue(0);

        // Desliza B para cima e A para o centro
        Animated.parallel([
          Animated.timing(yB, {
            toValue: -44,
            duration: 450,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true,
          }),
          Animated.timing(opB, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(yA, {
            toValue: 0,
            duration: 450,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true,
          }),
          Animated.timing(opA, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished) {
            yB.setValue(44);
            activeSlotRef.current = "A";
            setCurrentSlot("A");
            nextItemIndexRef.current = (nextIndex + 1) % items.length;
          }
          isAnimatingRef.current = false;
        });
      }
    }, intervalMs);

    return () => {
      clearInterval(timer);
      yA.stopAnimation();
      opA.stopAnimation();
      yB.stopAnimation();
      opB.stopAnimation();
      isAnimatingRef.current = false;
    };
  }, [items, intervalMs, yA, opA, yB, opB]);

  if (!items || items.length === 0) {
    return null;
  }

  const handlePress = () => {
    const currentItem = activeSlotRef.current === "A" ? slotA : slotB;
    if (!currentItem || !currentItem.title) return;

    vibrationService.light();
    logUserInteraction({
      component: "<RecentSearchTicker />",
      label: currentItem.title,
      fileOrScreen: "src/components/RecentSearchTicker.tsx",
      action: "Selecionar busca recente do letreiro vertical",
      details: {
        id: currentItem.id,
        query: currentItem.query,
        address: currentItem.address,
      },
    });
    onSelectItem(currentItem);
  };

  const currentVisibleTitle =
    activeSlotRef.current === "A" ? slotA.title : slotB.title;

  return (
    <Pressable
      testID={testID}
      style={({ pressed }) => [
        styles.container,
        isDark
          ? {
              backgroundColor: "rgba(255,255,255,0.06)",
              borderColor: "rgba(255,255,255,0.06)",
            }
          : {
              backgroundColor: "#F0F5FF",
              borderColor: "transparent",
            },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Última busca recente: ${currentVisibleTitle || "Local"}. Toque para navegar.`}
      accessibilityHint="Inicia a busca por este destino selecionado"
    >
      {/* Ícone de Relógio com Badge Circular */}
      <View
        style={[styles.iconWrapper, { backgroundColor: theme.primary + "1A" }]}
      >
        <Ionicons name="time-outline" size={20} color={theme.primary} />
      </View>

      {/* Janela de Rolagem Vertical (Letreiro Infinito com Marquee Horizontal) */}
      <View style={styles.tickerWindow}>
        {items.length <= 1 ? (
          <View style={styles.textSlot}>
            <MarqueeText
              style={[styles.title, { color: theme.text }]}
              speed={32}
              delay={1400}
              active={true}
              testID="recent-ticker-title"
            >
              {items[0].title}
            </MarqueeText>
            <MarqueeText
              style={[styles.subtitle, { color: theme.textMuted }]}
              speed={28}
              delay={1800}
              active={true}
              testID="recent-ticker-subtitle"
            >
              {items[0].subtitle}
            </MarqueeText>
          </View>
        ) : (
          <>
            {/* Slot A */}
            <Animated.View
              style={[
                styles.textSlot,
                styles.slotAbsolute,
                {
                  transform: [{ translateY: yA }],
                  opacity: opA,
                },
              ]}
            >
              <MarqueeText
                style={[styles.title, { color: theme.text }]}
                speed={32}
                delay={1400}
                active={currentSlot === "A"}
                testID="recent-ticker-title-a"
              >
                {slotA.title}
              </MarqueeText>
              <MarqueeText
                style={[styles.subtitle, { color: theme.textMuted }]}
                speed={28}
                delay={1800}
                active={currentSlot === "A"}
                testID="recent-ticker-subtitle-a"
              >
                {slotA.subtitle}
              </MarqueeText>
            </Animated.View>

            {/* Slot B */}
            <Animated.View
              style={[
                styles.textSlot,
                styles.slotAbsolute,
                {
                  transform: [{ translateY: yB }],
                  opacity: opB,
                },
              ]}
            >
              <MarqueeText
                style={[styles.title, { color: theme.text }]}
                speed={32}
                delay={1400}
                active={currentSlot === "B"}
                testID="recent-ticker-title-b"
              >
                {slotB.title}
              </MarqueeText>
              <MarqueeText
                style={[styles.subtitle, { color: theme.textMuted }]}
                speed={28}
                delay={1800}
                active={currentSlot === "B"}
                testID="recent-ticker-subtitle-b"
              >
                {slotB.subtitle}
              </MarqueeText>
            </Animated.View>
          </>
        )}
      </View>

      {/* Seta de navegação */}
      <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tickerWindow: {
    flex: 1,
    height: 44,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  textSlot: {
    height: 44,
    justifyContent: "center",
    width: "100%",
  },
  slotAbsolute: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
});
