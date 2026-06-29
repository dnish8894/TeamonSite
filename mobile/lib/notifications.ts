import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { supabase } from './supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

/**
 * Requests notification permission, retrieves the device's Expo push token,
 * and upserts it against the logged-in app user. No-ops on simulators or
 * if the project isn't linked to EAS yet (no projectId configured).
 */
export async function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    })
  }

  if (!Device.isDevice) {
    console.log('Push notifications require a physical device.')
    return null
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') {
    console.log('Push notification permission was not granted.')
    return null
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
  if (!projectId) {
    console.log('No EAS projectId configured — run `eas init` to enable push notifications.')
    return null
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId })
    const token = data

    const { error } = await supabase
      .from('expo_push_tokens')
      .upsert({ user_id: userId, token }, { onConflict: 'token' })

    if (error) {
      console.log('Failed to save push token:', error.message)
      return null
    }
    return token
  } catch (err) {
    console.log('Failed to get push token:', err)
    return null
  }
}

/** Removes this device's push token, e.g. on logout. */
export async function unregisterPushToken(token: string | null) {
  if (!token) return
  await supabase.from('expo_push_tokens').delete().eq('token', token)
}
