import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BackgroundGradient } from './BackgroundGradient';

interface NavegacaoEmbarcadoProps {
  isDark: boolean;
  theme: any;
  insets: { top: number; bottom: number; left: number; right: number };
  busLine: string;
  onBusFeedback: "facil" | "tranquilo" | "dificil" | null;
  setOnBusFeedback: (val: "facil" | "tranquilo" | "dificil") => void;
  handleSair: () => void;
  speakControlled: (text: string, force?: boolean) => void;
}

export function NavegacaoEmbarcado({
  isDark,
  theme,
  insets,
  busLine,
  onBusFeedback,
  setOnBusFeedback,
  handleSair,
  speakControlled,
}: NavegacaoEmbarcadoProps) {
  const router = useRouter();

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? theme.background : "transparent", zIndex: 999, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 24) }]}>
      {!isDark && <BackgroundGradient />}

      {/* Header */}
      <View style={styles.onBusHeader}>
        <Pressable onPress={handleSair} style={[styles.onBusHeaderPill, { backgroundColor: theme.card }]}>
          <Ionicons name="chevron-back" size={18} color="#2563EB" />
          <Text style={[styles.onBusHeaderPillText, { color: theme.text }]}>Voltar</Text>
        </Pressable>
      </View>

      {/* Content */}
      <View style={styles.onBusContent}>
        <Text style={[styles.onBusGiantTitle, { color: theme.text }]}>Boa viagem!</Text>
        
        <Text style={[styles.onBusDescription, { color: theme.textMuted }]}>
          Você já está a bordo da <Text style={{ fontWeight: "800", color: theme.text }}>Linha {busLine}</Text>. O RotaBus guiou seus passos com segurança até o ponto.
        </Text>

        <View style={[styles.onBusFeedbackBox, { backgroundColor: theme.card, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'transparent', borderWidth: isDark ? 1 : 0 }]}>
          <Text style={[styles.onBusFeedbackTitle, { color: theme.text }]}>Como foi o trajeto a pé até o ponto?</Text>
          <Text style={[styles.onBusFeedbackSubtitle, { color: theme.textMuted }]}>Sua avaliação calibra a precisão dos alertas.</Text>
          
          <View style={styles.onBusFeedbackOptions}>
            <Pressable 
              style={[styles.onBusFeedbackOption, onBusFeedback === "facil" && styles.onBusFeedbackOptionSelected, { backgroundColor: onBusFeedback === "facil" ? (isDark ? "rgba(37,99,235,0.2)" : "#EFF6FF") : "transparent", borderColor: onBusFeedback === "facil" ? "#93C5FD" : (isDark ? "rgba(255,255,255,0.1)" : "#F1F5F9") }]} 
              onPress={() => setOnBusFeedback("facil")}
            >
              <Text style={styles.onBusFeedbackEmoji}>😊</Text>
              <Text style={[styles.onBusFeedbackOptionText, { color: theme.text }]}>Fácil</Text>
            </Pressable>
            <Pressable 
              style={[styles.onBusFeedbackOption, onBusFeedback === "tranquilo" && styles.onBusFeedbackOptionSelected, { backgroundColor: onBusFeedback === "tranquilo" ? (isDark ? "rgba(37,99,235,0.2)" : "#EFF6FF") : "transparent", borderColor: onBusFeedback === "tranquilo" ? "#93C5FD" : (isDark ? "rgba(255,255,255,0.1)" : "#F1F5F9") }]} 
              onPress={() => setOnBusFeedback("tranquilo")}
            >
              <Text style={styles.onBusFeedbackEmoji}>👌</Text>
              <Text style={[styles.onBusFeedbackOptionText, { color: theme.text }]}>Tranquilo</Text>
            </Pressable>
            <Pressable 
              style={[styles.onBusFeedbackOption, onBusFeedback === "dificil" && styles.onBusFeedbackOptionSelected, { backgroundColor: onBusFeedback === "dificil" ? (isDark ? "rgba(37,99,235,0.2)" : "#EFF6FF") : "transparent", borderColor: onBusFeedback === "dificil" ? "#93C5FD" : (isDark ? "rgba(255,255,255,0.1)" : "#F1F5F9") }]} 
              onPress={() => setOnBusFeedback("dificil")}
            >
              <Text style={styles.onBusFeedbackEmoji}>😓</Text>
              <Text style={[styles.onBusFeedbackOptionText, { color: theme.text }]}>Difícil</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Bottom Actions */}
      <View style={{ paddingHorizontal: 16 }}>
        <View 
          style={[
            styles.waitingCardContent,
            isDark 
              ? { backgroundColor: theme.card, borderColor: 'rgba(255, 255, 255, 0.1)' }
              : { backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.05)' },
            { padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 8 }
          ]}
        >
          <View style={{ flexDirection: "row", gap: 8, alignItems: 'stretch' }}>
            <Pressable
              onPress={() => router.replace("/inicio")}
              style={({ pressed }) => [
                styles.waitingSecondaryBtn,
                isDark ? styles.waitingSecondaryBtnDark : styles.waitingSecondaryBtnLight,
                { backgroundColor: '#007AFF', borderColor: '#007AFF' },
                pressed && { opacity: 0.75 },
                { flex: 1, shadowColor: "#007AFF", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }
              ]}
            >
              <Ionicons name="checkmark" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={[styles.waitingSecondaryBtnText, { color: '#FFFFFF' }]}>
                Concluir navegação
              </Text>
            </Pressable>

            <Pressable
              onPress={() => speakControlled("Você já está a bordo da Linha. Boa viagem!", true)}
              accessibilityRole="button"
              accessibilityLabel="Ouvir aviso de boa viagem"
              style={({ pressed }) => [
                styles.waitingSecondaryBtn,
                isDark ? styles.waitingSecondaryBtnDark : styles.waitingSecondaryBtnLight,
                pressed && { opacity: 0.75 },
                { width: 56, paddingVertical: 0, justifyContent: 'center', alignItems: 'center' }
              ]}
            >
              <Ionicons 
                name="volume-high-outline" 
                size={26} 
                color={isDark ? '#FFFFFF' : '#111827'} 
              />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  onBusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 20,
    marginTop: 8,
  },
  onBusHeaderPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  onBusHeaderPillText: {
    fontSize: 16,
    fontWeight: "700",
  },
  onBusContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  onBusGiantTitle: {
    fontSize: 40,
    fontWeight: "900",
    marginBottom: 12,
    textAlign: "center",
  },
  onBusDescription: {
    fontSize: 18,
    lineHeight: 26,
    textAlign: "center",
    marginBottom: 40,
    paddingHorizontal: 16,
  },
  onBusFeedbackBox: {
    alignItems: "center",
    width: "100%",
    padding: 24,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  onBusFeedbackTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  onBusFeedbackSubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  onBusFeedbackOptions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    justifyContent: "space-between",
  },
  onBusFeedbackOption: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  onBusFeedbackOptionSelected: {
    borderWidth: 1,
  },
  onBusFeedbackEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  onBusFeedbackOptionText: {
    fontSize: 14,
    fontWeight: "700",
  },
  waitingCardContent: {
    borderRadius: 32,
    borderWidth: 1,
    overflow: "hidden",
  },
  waitingSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 56,
  },
  waitingSecondaryBtnDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  waitingSecondaryBtnLight: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  waitingSecondaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
