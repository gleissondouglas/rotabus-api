import React, { useEffect, useRef, useState } from "react";
import {
  Text,
  View,
  Animated as RNAnimated,
  Easing,
  TextProps,
  StyleSheet,
  ScrollView,
  StyleProp,
  ViewStyle,
} from "react-native";

export interface MarqueeTextProps extends Omit<TextProps, "numberOfLines" | "ellipsizeMode"> {
  children: React.ReactNode;
  mode?: "restart" | "continuous" | "ping-pong";
  speed?: number; // pixels por segundo (padrão: 32)
  delay?: number; // pausa antes de começar a rolar (ms)
  loopDelay?: number; // pausa no fim antes de retornar/repetir (ms)
  spacing?: number; // espaçamento entre repetições em modo continuous (px)
  active?: boolean; // controla se a animação deve rodar
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

function getTextContent(children: React.ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(getTextContent).join("");
  }
  return "";
}

export function MarqueeText({
  style,
  children,
  mode = "restart",
  speed = 32,
  delay = 1400,
  loopDelay = 1200,
  spacing = 40,
  active = true,
  containerStyle,
  testID,
  ...props
}: MarqueeTextProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const scrollAnim = useRef(new RNAnimated.Value(0)).current;
  const opacityAnim = useRef(new RNAnimated.Value(1)).current;

  const textContent = getTextContent(children);
  const shouldAnimate = active && contentWidth > containerWidth && containerWidth > 0;

  // Reset imediato se o texto mudar
  useEffect(() => {
    scrollAnim.stopAnimation();
    scrollAnim.setValue(0);
    opacityAnim.stopAnimation();
    opacityAnim.setValue(1);
  }, [textContent, scrollAnim, opacityAnim]);

  useEffect(() => {
    scrollAnim.stopAnimation();
    scrollAnim.setValue(0);
    opacityAnim.stopAnimation();
    opacityAnim.setValue(1);

    if (!shouldAnimate) {
      return;
    }

    let animation: RNAnimated.CompositeAnimation | null = null;

    if (mode === "continuous") {
      // Modo contínuo: esteira sem parar com texto duplicado
      const cycleDistance = contentWidth + spacing;
      const cycleDuration = (cycleDistance / Math.max(speed, 5)) * 1000;

      animation = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.delay(delay),
          RNAnimated.timing(scrollAnim, {
            toValue: -cycleDistance,
            duration: cycleDuration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          RNAnimated.timing(scrollAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    } else if (mode === "ping-pong") {
      // Modo boomerang legado
      const distance = contentWidth - containerWidth + 8;
      const forwardDuration = (distance / Math.max(speed, 5)) * 1000;
      const backwardDuration = Math.max((distance / (Math.max(speed, 5) * 1.2)) * 1000, 350);

      animation = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.delay(delay),
          RNAnimated.timing(scrollAnim, {
            toValue: -distance,
            duration: forwardDuration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          RNAnimated.delay(loopDelay),
          RNAnimated.timing(scrollAnim, {
            toValue: 0,
            duration: backwardDuration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          RNAnimated.delay(loopDelay),
        ])
      );
    } else {
      // Modo padrão (restart): rola até o fim, pausa para leitura,
      // volta suavemente ao início (sem dar ré!) e rola novamente para a frente
      const distance = contentWidth - containerWidth + 8;
      const forwardDuration = (distance / Math.max(speed, 5)) * 1000;

      animation = RNAnimated.loop(
        RNAnimated.sequence([
          // 1. Pausa no início para leitura
          RNAnimated.delay(delay),

          // 2. Rola para a frente até o final do texto
          RNAnimated.timing(scrollAnim, {
            toValue: -distance,
            duration: forwardDuration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),

          // 3. Pausa no final para ler o término
          RNAnimated.delay(loopDelay),

          // 4. Fade out suave no final (sem dar ré)
          RNAnimated.timing(opacityAnim, {
            toValue: 0,
            duration: 250,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),

          // 5. Reposiciona instantaneamente para o início enquanto invisível
          RNAnimated.timing(scrollAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),

          // 6. Fade in suave de volta no início
          RNAnimated.timing(opacityAnim, {
            toValue: 1,
            duration: 250,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
    }

    animation.start();

    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [
    shouldAnimate,
    mode,
    contentWidth,
    containerWidth,
    speed,
    delay,
    loopDelay,
    spacing,
    textContent,
    scrollAnim,
    opacityAnim,
  ]);

  return (
    <View
      style={[styles.container, containerStyle]}
      onLayout={(e) => {
        const w = Math.floor(e.nativeEvent.layout.width);
        if (w > 0 && Math.abs(w - containerWidth) > 1) {
          setContainerWidth(w);
        }
      }}
      pointerEvents="none"
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={textContent}
    >
      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
      >
        <RNAnimated.View
          style={[
            styles.animatedContent,
            {
              transform: [{ translateX: scrollAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* Texto principal: sem numberOfLines e sem reticências */}
          <Text
            {...props}
            style={[style, styles.unconstrainedText]}
            onLayout={(e) => {
              const w = Math.ceil(e.nativeEvent.layout.width);
              if (w > 0 && Math.abs(w - contentWidth) > 1) {
                setContentWidth(w);
              }
            }}
          >
            {children}
          </Text>

          {/* Repetição para loop contínuo quando modo continuous estiver ativo */}
          {mode === "continuous" && shouldAnimate && (
            <>
              <View style={{ width: spacing }} />
              <Text
                {...props}
                style={[style, styles.unconstrainedText]}
                aria-hidden
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {children}
              </Text>
            </>
          )}
        </RNAnimated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    width: "100%",
    position: "relative",
    justifyContent: "center",
  },
  scrollView: {
    width: "100%",
    flexGrow: 0,
  },
  scrollContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  animatedContent: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
  },
  unconstrainedText: {
    width: undefined,
    maxWidth: undefined,
    flexShrink: 0,
  },
});
