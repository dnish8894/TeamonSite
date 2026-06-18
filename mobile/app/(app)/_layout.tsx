import { Tabs } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'

function TabIcon({ name, focused, label }: { name: string; focused: boolean; label: string }) {
  const icons: Record<string, string> = {
    index:    focused ? '🎫' : '🎫',
    scan:     '📷',
    schedule: '📅',
    profile:  '👤',
  }
  return (
    <View style={styles.tabItem}>
      <Text style={styles.tabEmoji}>{icons[name] ?? '●'}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  )
}

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown:       false,
        tabBarStyle:       styles.tabBar,
        tabBarShowLabel:   false,
        tabBarActiveTintColor:   '#f97316',
        tabBarInactiveTintColor: '#6b7280',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'My Tickets',
          tabBarIcon: ({ focused }) => <TabIcon name="index" focused={focused} label="Tickets" />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan QR',
          tabBarIcon: ({ focused }) => <TabIcon name="scan" focused={focused} label="Scan" />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ focused }) => <TabIcon name="schedule" focused={focused} label="Schedule" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} label="Profile" />,
        }}
      />
      {/* Hidden — only navigated to */}
      <Tabs.Screen name="tickets/[id]" options={{ href: null }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#1c1917',
    borderTopColor:  '#292524',
    borderTopWidth:  1,
    height: 70,
    paddingBottom: 10,
  },
  tabItem:  { alignItems: 'center', paddingTop: 4 },
  tabEmoji: { fontSize: 20 },
  tabLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  tabLabelActive: { color: '#f97316' },
})
