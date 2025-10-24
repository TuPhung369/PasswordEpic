// Mock for react-native-safe-area-context
const React = require('react');
const { View } = require('react-native');

const SafeAreaView = ({ children, ...props }) =>
  React.createElement(View, props, children);

const SafeAreaProvider = ({ children, ...props }) =>
  React.createElement(View, props, children);

module.exports = {
  SafeAreaView,
  SafeAreaProvider,
  useSafeAreaInsets: () => ({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  }),
};
