import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import NotificationCenter from './src/components/NotificationCenter';
import Realtime from './src/realtime';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider><SafeAreaView edges={['top','bottom','left','right']} style={{ flex: 1, backgroundColor: '#20345c' }}><AuthProvider>
      <StatusBar style="light" />
      <RootNavigator />
      <NotificationCenter />
      <Realtime />
    </AuthProvider></SafeAreaView></SafeAreaProvider>
  );
}
