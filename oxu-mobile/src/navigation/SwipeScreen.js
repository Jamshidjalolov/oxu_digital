import React, { useMemo } from "react";
import { View, PanResponder, useWindowDimensions } from "react-native";
export default function withSwipe(Screen) {
  return function SwipeScreen(props) {
    const { width } = useWindowDimensions();
    const responder = useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponder: (event, g) =>
            (g.x0 < 30 || g.x0 > width - 30) &&
            Math.abs(g.dx) > 40 &&
            Math.abs(g.dy) < 20,
          onPanResponderRelease: (event, g) => {
            if (Math.abs(g.dx) < 65 || Math.abs(g.dy) > 45) return;
            const state = props.navigation.getState();
            const index = state.index + (g.dx < 0 ? 1 : -1);
            if (state.routes[index])
              props.navigation.navigate(state.routes[index].name);
          },
        }),
      [width, props.navigation],
    );
    return (
      <View style={{ flex: 1 }} {...responder.panHandlers}>
        <Screen {...props} />
      </View>
    );
  };
}
