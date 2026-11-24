import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { tabScreenOptions } from './tabOptions';
import StudentHomeScreen from '../screens/student/StudentHomeScreen';
import StudentAttendanceScreen from '../screens/student/StudentAttendanceScreen';
import StudentProfileScreen from '../screens/student/StudentProfileScreen';

import withSwipe from './SwipeScreen';
const Tab = createBottomTabNavigator();
const SwipeStudentHomeScreen = withSwipe(StudentHomeScreen);
const SwipeStudentAttendanceScreen = withSwipe(StudentAttendanceScreen);
const SwipeStudentProfileScreen = withSwipe(StudentProfileScreen);

export default function StudentTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen
        name="Home"
        component={SwipeStudentHomeScreen}
        options={{ title: 'Bosh sahifa' }}
      />
      <Tab.Screen
        name="Davomat"
        component={SwipeStudentAttendanceScreen}
        options={{ title: 'Davomat' }}
      />
      <Tab.Screen
        name="Profile"
        component={SwipeStudentProfileScreen}
        options={{ title: 'Profil' }}
      />
    </Tab.Navigator>
  );
}
