import React, { useRef } from 'react';
import { Animated, Pressable } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function PressableScale({
  children,
  style,
  onPress,
  disabled,
  activeScale = 0.97,
  ...rest
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (toValue) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  };

  return (
    <AnimatedPressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => animate(activeScale)}
      onPressOut={() => animate(1)}
      style={[style, { transform: [{ scale }] }]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
