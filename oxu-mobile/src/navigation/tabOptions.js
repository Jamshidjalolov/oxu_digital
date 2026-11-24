import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS } from '../config';

const TAB_ICONS = {
  Home: 'home',
  Davomat: 'checkbox',
  Profile: 'person',
  Users: 'people', Catalog: 'grid', Schedule: 'calendar', Report: 'bar-chart',
};

export function tabScreenOptions({ route }) {
  return {
    headerShown: false,
    animation: 'shift',
    tabBarActiveTintColor: '#e8eeff',
    tabBarInactiveTintColor: '#99aacb',
    tabBarHideOnKeyboard: true,
    tabBarStyle: styles.bar,
    tabBarLabelStyle: styles.label,
    tabBarItemStyle: styles.item,
    tabBarIcon: ({ color, focused }) => (
      <View style={[styles.iconPill, focused && styles.iconPillActive]}>
        <Ionicons
          name={focused ? TAB_ICONS[route.name] : `${TAB_ICONS[route.name]}-outline`}
          size={19}
          color={focused ? COLORS.white : color}
        />
      </View>
    ),
  };
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    height: 68,
    backgroundColor: '#263b65',
    borderTopWidth: 0,
    borderRadius: RADIUS.xl,
    paddingTop: 7,
    paddingBottom: 7,
    shadowColor: '#0f172a',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
  },
  item: {
    paddingVertical: 1,
  },
  iconPill: {
    width: 38,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.soft,
  },
  iconPillActive: {
    backgroundColor: '#526fa5',
  },
});
