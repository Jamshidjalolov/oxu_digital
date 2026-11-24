import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import { formatDateLong, COLORS, RADIUS, SHADOWS } from '../config';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function DaySection({
  dateKey,
  children,
  count = null,
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((value) => !value);
  };

  return (
    <View style={styles.wrap}>
      <PressableScale
        style={styles.header}
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={formatDateLong(dateKey)}
        activeScale={0.985}
      >
        <View style={styles.dateIcon}>
          <Ionicons name="calendar" size={17} color={COLORS.primary} />
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{formatDateLong(dateKey)}</Text>
          {count !== null ? (
            <Text style={styles.count}>
              {count > 0 ? `${count} ta dars` : "Dars yo'q"}
            </Text>
          ) : null}
        </View>
        <View style={styles.chevron}>
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={COLORS.muted}
          />
        </View>
      </PressableScale>
      {open ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    ...SHADOWS.soft,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
  },
  dateIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    textTransform: 'capitalize',
  },
  count: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.grayBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: 10,
    paddingBottom: 10,
    paddingTop: 2,
  },
});
