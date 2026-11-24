import React from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { COLORS, GRADIENTS } from '../config';
import LoginScreen from '../screens/auth/LoginScreen';
import TeacherTabs from './TeacherTabs';
import StudentTabs from './StudentTabs';
import TeacherAttendanceScreen from '../screens/teacher/TeacherAttendanceScreen';
import AdminScreen from './AdminTabs';

const Stack = createNativeStackNavigator();

const headerOptions = (title) => ({
  headerShown: true,
  title,
  headerTintColor: '#ffffff',
  headerShadowVisible: false,
  headerStyle: { backgroundColor: COLORS.primaryDark },
  headerTitleStyle: { fontWeight: '700' },
  headerBackTitle: 'Orqaga',
});

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <LinearGradient
        colors={GRADIENTS.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.splash}
      >
        <View style={styles.logoCircle}>
          <Image
            source={require('../../assets/oxu-logo.png')}
            accessibilityLabel="Osiyo Xalqaro Universiteti"
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.splashTitle}>OXU Digital</Text>
        <ActivityIndicator color="#ffffff" style={styles.spinner} />
      </LinearGradient>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : user.role === 'admin' ? (
          <Stack.Screen name="Admin" component={AdminScreen} />
        ) : user.role === 'student' ? (
          <Stack.Screen name="Student" component={StudentTabs} />
        ) : (
          <>
            <Stack.Screen name="Teacher" component={TeacherTabs} />
            <Stack.Screen
              name="Attendance"
              component={TeacherAttendanceScreen}
              options={headerOptions('Davomat')}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 68,
    height: 68,
  },
  splashTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 12,
  },
  spinner: {
    marginTop: 14,
  },
});
