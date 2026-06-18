import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { supabase } from '@/lib/supabase'

export default function LoginScreen() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleLogin() {
    if (!email.trim() || !password)
      return Alert.alert('Error', 'Please enter your email and password.')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) Alert.alert('Login Failed', error.message)
  }

  return (
    <KeyboardAvoidingView
      style={styles.bg}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar style="light" />

      {/* Logo */}
      <View style={styles.logoRow}>
        <Text style={styles.logoWhite}>TeamOn</Text>
        <Text style={styles.logoOrange}>Site</Text>
      </View>
      <Text style={styles.tagline}>Field Management · Engineer App</Text>

      {/* Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sign In</Text>
        <Text style={styles.cardSub}>Use your TeamOnSite account credentials</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="engineer@company.com"
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={[styles.label, { marginTop: 14 }]}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#6b7280"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={handleLogin}
        />

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Sign In</Text>}
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>InfiniteQL Sdn Bhd · TeamOnSite v1.0</Text>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#0c0a09',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  logoWhite:  { fontSize: 36, fontWeight: '800', color: '#fff',     letterSpacing: -1 },
  logoOrange: { fontSize: 36, fontWeight: '800', color: '#f97316',  letterSpacing: -1 },
  tagline: { color: '#6b7280', fontSize: 13, marginBottom: 40 },

  card: {
    width: '100%',
    backgroundColor: '#1c1917',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#292524',
  },
  cardTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  cardSub:   { color: '#6b7280', fontSize: 13, marginBottom: 22 },

  label: { color: '#a8a29e', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: '#0c0a09',
    borderWidth: 1,
    borderColor: '#292524',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
  },

  btn: {
    marginTop: 22,
    backgroundColor: '#f97316',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  footer: { color: '#44403c', fontSize: 11, marginTop: 32 },
})
