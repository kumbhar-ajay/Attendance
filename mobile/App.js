// FILE: mobile/App.js
import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useStore } from './src/store';
import LoginScreen from './src/screens/LoginScreen';
import ManagerHome from './src/screens/ManagerHome';
import AdminHome from './src/screens/AdminHome';
import WorkerHome from './src/screens/WorkerHome';
import MonthHistory from './src/screens/MonthHistory';
import CreateWorker from './src/screens/CreateWorker';
import DrawerContent from './src/screens/DrawerContent';
import HiddenWorkers from './src/screens/HiddenWorkers';
import CreateManager from './src/screens/CreateManager';
import DisabledWorkers from './src/screens/DisabledWorkers';
import BalancePayment from './src/screens/BalancePayment';
import { COLORS } from './src/config';

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

function ManagerDrawer() {
  return (
    <Drawer.Navigator drawerContent={(props) => <DrawerContent {...props} />} screenOptions={{ headerShown: false, drawerStyle: { width: 280 } }}>
      <Drawer.Screen name="ManagerHome" component={ManagerHome} />
      <Drawer.Screen name="CreateWorker" component={CreateWorker} />
      <Drawer.Screen name="MonthHistory" component={MonthHistory} />
      <Drawer.Screen name="HiddenWorkers" component={HiddenWorkers} />
      <Drawer.Screen name="DisabledWorkers" component={DisabledWorkers} />
    </Drawer.Navigator>
  );
}

function AdminDrawer() {
  return (
    <Drawer.Navigator drawerContent={(props) => <DrawerContent {...props} />} screenOptions={{ headerShown: false, drawerStyle: { width: 280 } }}>
      <Drawer.Screen name="AdminHome" component={AdminHome} />
      <Drawer.Screen name="CreateWorker" component={CreateWorker} />
      <Drawer.Screen name="CreateManager" component={CreateManager} />
      <Drawer.Screen name="MonthHistory" component={MonthHistory} />
      <Drawer.Screen name="ManagerHome" component={ManagerHome} />
      <Drawer.Screen name="HiddenWorkers" component={HiddenWorkers} />
      <Drawer.Screen name="DisabledWorkers" component={DisabledWorkers} />
      <Drawer.Screen name="BalancePayment" component={BalancePayment} />
    </Drawer.Navigator>
  );
}

export default function App() {
  const { user, isLoading, loadSession } = useStore();

  useEffect(() => { loadSession(); }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {!user ? (
              <Stack.Screen name="Login" component={LoginScreen} />
            ) : user.role === 'admin' ? (
              <Stack.Screen name="AdminApp" component={AdminDrawer} />
            ) : user.role === 'manager' ? (
              <Stack.Screen name="ManagerApp" component={ManagerDrawer} />
            ) : (
              <Stack.Screen name="WorkerApp" component={WorkerHome} />
            )}
          </Stack.Navigator>
          <Toast />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}