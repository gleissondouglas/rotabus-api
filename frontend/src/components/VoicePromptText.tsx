import { useEffect, useState } from "react";
import {
  Platform,
  StyleSheet,
  View,
  ScrollView,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useThemeColors } from "../theme/colors";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const WORD_INTERVAL_MS = 110;

interface VoicePromptTextProps {
  /**
   * Texto completo da assistente.
   */
  text: string;
  /**
   * Quando true, exibe o texto de forma progressiva (palavra por palavra).
   * Quando false, exibe tudo de uma vez (ex: ao voltar para a tela).
   */
  animated: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  align?: "center" | "left";
}

interface AnimatedWordProps {
  word: string;
  index: number;
  textStyle?: StyleProp<TextStyle>;
}

function AnimatedWord({ word, index, textStyle }: AnimatedWordProps) {
  const opacity = useSharedValue(0);
  const theme = useThemeColors();

  useEffect(() => {
    const delay = index * WORD_INTERVAL_MS;
    const timer = setTimeout(() => {
      opacity.value = withTiming(1, { duration: 250 });
    }, delay);
    return () => clearTimeout(timer);
  }, [index, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.Text
      entering={FadeInDown.delay(index * WORD_INTERVAL_MS).duration(260)}
      style={[styles.word, { color: theme.text }, textStyle, animStyle]}
    >
      {word}{" "}
    </Animated.Text>
  );
}

/**
 * VoicePromptText — exibe a mensagem da assistente de forma progressiva.
 *
 * - `animated=true`: cada palavra entra com leve animação de baixo pra cima.
 * - `animated=false`: texto completo aparece de uma vez (retorno à tela).
 */
export function VoicePromptText({
  text,
  animated,
  style,
  textStyle,
  align = "center",
}: VoicePromptTextProps) {
  const [words, setWords] = useState<string[]>([]);
  const theme = useThemeColors();

  useEffect(() => {
    if (!text) {
      setWords([]);
      return;
    }
    setWords(text.split(" ").filter(Boolean));
  }, [text]);

  if (!text) {
    return null;
  }

  const isScrollable = text.length > 40;

  if (!animated) {
    const textNode = (
      <Animated.Text
        entering={FadeInDown.duration(400)}
        style={[styles.staticText, { color: theme.text }, align === "left" && styles.leftText, textStyle]}
      >
        {text}
      </Animated.Text>
    );

    return (
      <View style={[styles.container, align === "left" && styles.leftAligned, style]}>
        {isScrollable ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {textNode}
          </ScrollView>
        ) : (
          textNode
        )}
      </View>
    );
  }

  const wordsNode = (
    <View style={[styles.wordsRow, align === "left" && styles.wordsRowLeft, !isScrollable && { flexWrap: "wrap" }]}>
      {words.map((word, index) => (
        <AnimatedWord
          key={`${word}-${index}`}
          word={word}
          index={index}
          textStyle={[align === "left" && styles.leftText, textStyle]}
        />
      ))}
    </View>
  );

  return (
    <View style={[styles.container, align === "left" && styles.leftAligned, style]}>
      {isScrollable ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {wordsNode}
        </ScrollView>
      ) : (
        wordsNode
      )}
    </View>
  );
}

const APPLE_FONT = Platform.select({
  ios: { fontFamily: "System" },
  default: { fontFamily: "System" },
});

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  leftAligned: {
    alignItems: "flex-start",
    paddingHorizontal: 0,
  },
  wordsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
  },
  wordsRowLeft: {
    justifyContent: "flex-start",
  },
  word: {
    fontSize: 26,
    fontWeight: "800",
    color: "#011030",
    lineHeight: 36,
    letterSpacing: -0.4,
    textAlign: "center",
    ...APPLE_FONT,
  },
  leftText: {
    textAlign: "left",
  },
  staticText: {
    fontSize: 26,
    fontWeight: "800",
    color: "#011030",
    lineHeight: 36,
    letterSpacing: -0.4,
    textAlign: "center",
    ...APPLE_FONT,
  },
});
