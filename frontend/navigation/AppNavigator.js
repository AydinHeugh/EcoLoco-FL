import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import TabIcon, { tabPressed } from '../components/TabIcon'

import HomeScreen from '../screens/HomeScreen'
import IdentificationScreen from '../screens/IdentificationScreen'
import RecommendationScreen from '../screens/RecommendationScreen'
import AuditScreen from '../screens/AuditScreen'
import AuditResultsScreen from '../screens/AuditResultsScreen'
import { COLORS, FONTS, TYPE, LINE } from '../theme'

const Tab   = createBottomTabNavigator()
const Stack = createNativeStackNavigator()


function TabNavigator() {
  const insets = useSafeAreaInsets()
  return (
    <Tab.Navigator
      screenListeners={({ route }) => ({ tabPress: () => tabPressed(route.name) })}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.darkGreen,
          borderTopWidth: 0,
          height: 62 + Math.max(insets.bottom, 10),
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontFamily: FONTS.bodyMedium, fontSize: TYPE.caption, lineHeight: LINE.caption, paddingBottom: 2 },
        tabBarItemStyle: { paddingHorizontal: 0 },
        tabBarAllowFontScaling: false,
        tabBarActiveTintColor:   COLORS.accentOnDark,
        tabBarInactiveTintColor: COLORS.tabInactive,
        tabBarIcon: ({ color, size, focused }) => {
          const icons = {
            Home:     focused ? 'home' : 'home-outline',
            Camera:   focused ? 'leaf' : 'leaf-outline',
            EcoScan:  'scan-outline',
            Recommend: focused ? 'thumbs-up' : 'thumbs-up-outline',
          }
          return <TabIcon routeName={route.name} name={icons[route.name]} size={size} color={color} />
        },
      })}
    >
      <Tab.Screen name="Home"     component={HomeScreen} />
      <Tab.Screen name="Camera"   component={IdentificationScreen} options={{ tabBarLabel: 'Identify' }} />
      <Tab.Screen name="EcoScan"  component={AuditScreen} options={{ unmountOnBlur: false }} />
      <Tab.Screen name="Recommend"component={RecommendationScreen} />
    </Tab.Navigator>
  )
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main"         component={TabNavigator} />
        <Stack.Screen name="AuditResults" component={AuditResultsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
