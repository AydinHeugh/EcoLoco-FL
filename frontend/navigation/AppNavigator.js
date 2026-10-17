import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import Ionicons from '@expo/vector-icons/Ionicons'

import HomeScreen from '../screens/HomeScreen'
import IdentificationScreen from '../screens/IdentificationScreen'
import RecommendationScreen from '../screens/RecommendationScreen'
import AuditScreen from '../screens/AuditScreen'
import AuditResultsScreen from '../screens/AuditResultsScreen'

const Tab   = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

const DARK_GREEN = '#1e3a1e'

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: DARK_GREEN,
          borderTopWidth: 0,
          height: 65,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor:   '#fff',
        tabBarInactiveTintColor: '#d9f2d9',
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Home:     'home',
            Camera:   'leaf',
            EcoScan:  'scan-outline',
            Recommend:'thumbs-up',
          }
          return <Ionicons name={icons[route.name]} size={size} color={color} />
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
