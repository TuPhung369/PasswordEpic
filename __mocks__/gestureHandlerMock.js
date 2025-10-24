// Mock for react-native-gesture-handler
const React = require('react');
const { View } = require('react-native');

const TapGestureHandler = ({ children, ...props }) =>
  React.createElement(View, props, children);

const PanGestureHandler = ({ children, ...props }) =>
  React.createElement(View, props, children);

const LongPressGestureHandler = ({ children, ...props }) =>
  React.createElement(View, props, children);

const Swipeable = ({ children, ...props }) =>
  React.createElement(View, props, children);

module.exports = {
  TapGestureHandler,
  PanGestureHandler,
  LongPressGestureHandler,
  Swipeable,
  GestureHandlerRootView: ({ children, ...props }) =>
    React.createElement(View, props, children),
  gestureHandlerRootHOC: Component => Component,
};
