import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { tabScreenOptions } from './tabOptions';
import TeacherHomeScreen from '../screens/teacher/TeacherHomeScreen';
import TeacherDavomatScreen from '../screens/teacher/TeacherDavomatScreen';
import TeacherProfileScreen from '../screens/teacher/TeacherProfileScreen';

import withSwipe from './SwipeScreen';
const Tab = createBottomTabNavigator();
const SwipeTeacherHomeScreen = withSwipe(TeacherHomeScreen);
const SwipeTeacherDavomatScreen = withSwipe(TeacherDavomatScreen);
const SwipeTeacherProfileScreen = withSwipe(TeacherProfileScreen);

export default function TeacherTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen
        name="Home"
        component={SwipeTeacherHomeScreen}
        options={{ title: 'Bosh sahifa' }}
      />
      <Tab.Screen
        name="Davomat"
        component={SwipeTeacherDavomatScreen}
        options={{ title: 'Davomat' }}
      />
      <Tab.Screen
        name="Profile"
        component={SwipeTeacherProfileScreen}
        options={{ title: 'Profil' }}
      />
    </Tab.Navigator>
  );
}
