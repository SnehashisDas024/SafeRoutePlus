import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import PlanScreen from './src/screens/Plan';
import RouteCompareScreen from './src/screens/RouteCompare';
import ActiveTripScreen from './src/screens/ActiveTrip';
import SOSScreen from './src/screens/SOS';
import ReportScreen from './src/screens/Report';
import ContactsScreen from './src/screens/Contacts';
import VoiceSetupScreen from './src/screens/VoiceSetup';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Plan" screenOptions={{ headerStyle: { backgroundColor: 'white' } }}>
        <Stack.Screen name="Plan" component={PlanScreen} />
        <Stack.Screen name="RouteCompare" component={RouteCompareScreen} />
        <Stack.Screen name="ActiveTrip" component={ActiveTripScreen} options={{ headerShown: false }} />
        <Stack.Screen name="SOS" component={SOSScreen} />
        <Stack.Screen name="Report" component={ReportScreen} />
        <Stack.Screen name="Contacts" component={ContactsScreen} />
        <Stack.Screen name="VoiceSetup" component={VoiceSetupScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}