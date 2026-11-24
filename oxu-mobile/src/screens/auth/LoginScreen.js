import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '../../components/PressableScale';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADIUS, SHADOWS } from '../../config';

export default function LoginScreen() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [focus, setFocus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!phone.trim() || !password) {
      setError('Telefon raqam va parolni kiriting');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await login(phone.trim(), password);
      // RootNavigator ro'lga qarab avtomatik yo'naltiradi
    } catch (e) {
      setError(
        (e.response && e.response.data && e.response.data.message) ||
          "Kirishda xatolik. Qaytadan urinib ko'ring"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient
      colors={['#101f46', '#203d7d', '#315eeb']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.flex}
    >
      <View pointerEvents="none" style={styles.circleA} />
      <View pointerEvents="none" style={styles.circleB} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <View style={styles.logoCircle}>
              <Image
                source={require('../../../assets/oxu-logo.png')}
                accessibilityLabel="Osiyo Xalqaro Universiteti"
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandTitle}>OXU Digital</Text>
            <Text style={styles.brandSub}>
              Osiyo Xalqaro Universiteti · Davomat tizimi
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tizimga kirish</Text>
            <Text style={styles.cardSub}>
              Telefon raqam va parol bilan davom eting
            </Text>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={COLORS.red} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>Telefon raqam</Text>
            <View
              style={[
                styles.inputWrap,
                focus === 'phone' && styles.inputFocus,
              ]}
            >
              <Ionicons
                name="call-outline"
                size={18}
                color={focus === 'phone' ? COLORS.primary : COLORS.muted}
              />
              <TextInput
                style={styles.input}
                placeholder="90 000 00 00"
                placeholderTextColor={COLORS.gray}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                onFocus={() => setFocus('phone')}
                onBlur={() => setFocus('')}
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.label}>Parol</Text>
            <View
              style={[
                styles.inputWrap,
                focus === 'password' && styles.inputFocus,
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={focus === 'password' ? COLORS.primary : COLORS.muted}
              />
              <TextInput
                style={styles.input}
                placeholder="••••••"
                placeholderTextColor={COLORS.gray}
                secureTextEntry={!showPass}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocus('password')}
                onBlur={() => setFocus('')}
              />
              <TouchableOpacity
                onPress={() => setShowPass(!showPass)}
                accessibilityLabel={showPass ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
              >
                <Ionicons
                  name={showPass ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={COLORS.muted}
                />
              </TouchableOpacity>
            </View>

            <PressableScale
              style={[styles.button, busy && styles.buttonBusy]}
              onPress={submit}
              disabled={busy}
              accessibilityLabel="Kirish"
            >
              <LinearGradient
                colors={['#2563eb', '#1e40af']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                {busy ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Text style={styles.buttonText}>Kirish</Text>
                    <Ionicons name="arrow-forward" size={18} color="#ffffff" />
                  </>
                )}
              </LinearGradient>
            </PressableScale>

            <View style={styles.footerRow}>
              <Ionicons name="information-circle-outline" size={15} color={COLORS.muted} />
              <Text style={styles.footerText}>
                Hisobni administrator yaratadi. Kirish ma’lumotlarini
                administratordan oling.
              </Text>
            </View>
          </View>

          <View style={styles.features}>
            <View style={styles.featurePill}>
              <Ionicons name="notifications-outline" size={13} color="rgba(255,255,255,0.9)" />
              <Text style={styles.featureText}>Push xabarlar</Text>
            </View>
            <View style={styles.featurePill}>
              <Ionicons name="paper-plane-outline" size={13} color="rgba(255,255,255,0.9)" />
              <Text style={styles.featureText}>Telegram</Text>
            </View>
            <View style={styles.featurePill}>
              <Ionicons name="shield-checkmark-outline" size={13} color="rgba(255,255,255,0.9)" />
              <Text style={styles.featureText}>Xavfsiz</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, overflow: 'hidden' },
  circleA: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -100,
    right: -90,
  },
  circleB: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: -70,
    left: -70,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingVertical: 40,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoCircle: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  logo: {
    width: 66,
    height: 66,
  },
  brandTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  brandSub: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 5,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: 22,
    ...SHADOWS.card,
  },
  cardTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: COLORS.text,
  },
  cardSub: {
    fontSize: 12.5,
    color: COLORS.muted,
    marginTop: 3,
    marginBottom: 18,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.redBg,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 12.5,
    color: COLORS.red,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
    marginBottom: 6,
    marginLeft: 2,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  inputFocus: {
    borderColor: COLORS.primary,
    backgroundColor: '#ffffff',
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 50,
    fontSize: 15,
    color: COLORS.text,
  },
  button: {
    borderRadius: RADIUS.md,
    marginTop: 4,
    overflow: 'hidden',
    ...SHADOWS.float,
  },
  buttonBusy: {
    opacity: 0.75,
  },
  buttonGradient: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 16,
  },
  footerText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
    color: COLORS.muted,
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 22,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  featureText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10.5,
    fontWeight: '600',
  },
});
