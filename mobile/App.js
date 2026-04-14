// FILE: mobile/App.js
import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { ActivityIndicator, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useStore } from './src/store';
import LoginScreen from './src/screens/LoginScreen';
import ManagerHome from './src/screens/ManagerHome';
import AdminHome from './src/screens/AdminHome';
import WorkerHome from './src/screens/WorkerHome';
import MonthHistory from './src/screens/MonthHistory';
import CreateWorker from './src/screens/CreateWorker';
import DrawerContent from './src/screens/DrawerContent';
import { COLORS } from './src/config';

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

function ManagerDrawer() {
  return (
    <Drawer.Navigator drawerContent={(props) => <DrawerContent {...props} />} screenOptions={{ headerShown: false, drawerStyle: { width: 280 } }}>
      <Drawer.Screen name="ManagerHome" component={ManagerHome} />
      <Drawer.Screen name="CreateWorker" component={CreateWorker} />
      <Drawer.Screen name="MonthHistory" component={MonthHistory} />
    </Drawer.Navigator>
  );
}

function AdminDrawer() {
  return (
    <Drawer.Navigator drawerContent={(props) => <DrawerContent {...props} />} screenOptions={{ headerShown: false, drawerStyle: { width: 280 } }}>
      <Drawer.Screen name="AdminHome" component={AdminHome} />
      <Drawer.Screen name="CreateWorker" component={CreateWorker} />
      <Drawer.Screen name="MonthHistory" component={MonthHistory} />
      <Drawer.Screen name="ManagerHome" component={ManagerHome} />
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

  const getInitialRoute = () => {
    if (!user) return 'Login';
    if (user.role === 'admin') return 'AdminApp';
    if (user.role === 'manager') return 'ManagerApp';
    return 'WorkerApp';
  };

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={getInitialRoute()} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="ManagerApp" component={ManagerDrawer} />
        <Stack.Screen name="AdminApp" component={AdminDrawer} />
        <Stack.Screen name="WorkerApp" component={WorkerHome} />
      </Stack.Navigator>
      <Toast />
    </NavigationContainer>
  );
}