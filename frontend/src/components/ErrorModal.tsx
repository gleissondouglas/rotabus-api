import React from "react";
import {
  Modal,
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useThemeColors } from "../theme/colors";
import { logUserInteraction } from "../utils/devLogger";
import { usePreventDoublePress } from "../hooks/usePreventDoublePress";

export type ErrorModalProps = {
  visible: boolean;
  title?: string;
  message: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  onClose: () => void;
};

export function ErrorModal({
  visible,
  title = "Aviso",
  message,
  primaryActionLabel = "Tentar de novo",
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  onClose,
}: ErrorModalProps) {
  const theme = useThemeColors();
  const handlePrimaryPress = usePreventDoublePress(() => {
    logUserInteraction({
      component: "<ErrorModal />",
      label: primaryActionLabel,
      fileOrScreen: "src/components/ErrorModal.tsx",
      action: "Clicou no botão primário do modal de erro",
    });
    if (onPrimaryAction) {
      onPrimaryAction();
    } else {
      onClose();
    }
  });

  const handleSecondaryPress = usePreventDoublePress(() => {
    logUserInteraction({
      component: "<ErrorModal />",
      label: secondaryActionLabel || "Ação secundária",
      fileOrScreen: "src/components/ErrorModal.tsx",
      action: "Clicou no botão secundário do modal de erro",
    });
    if (onSecondaryAction) {
      onSecondaryAction();
    }
  });

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={styles.backdropTouch}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar aviso"
        />

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
          accessible
          accessibilityViewIsModal
          accessibilityRole="alert"
          accessibilityLabel={`${title}. ${message}`}
        >
          {/* Ícone Acolhedor no Topo */}
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: theme.primaryLight || "rgba(0, 122, 255, 0.12)" },
            ]}
          >
            <Ionicons name="information-circle-outline" size={36} color={theme.primary} />
          </View>

          {/* Título e Mensagem */}
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.message, { color: theme.textMuted }]}>
            {message}
          </Text>

          {/* Botões de Ação */}
          <View style={styles.actionsContainer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={primaryActionLabel}
              style={[styles.primaryButton, { backgroundColor: theme.primary }]}
              onPress={handlePrimaryPress}
            >
              <Text style={[styles.primaryButtonText, { color: theme.white }]}>
                {primaryActionLabel}
              </Text>
            </Pressable>

            {secondaryActionLabel && onSecondaryAction && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={secondaryActionLabel}
                style={[
                  styles.secondaryButton,
                  { borderColor: theme.border, backgroundColor: "transparent" },
                ]}
                onPress={handleSecondaryPress}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                  {secondaryActionLabel}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  iconWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 24,
  },
  actionsContainer: {
    width: "100%",
    gap: 12,
  },
  primaryButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    width: "100%",
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
