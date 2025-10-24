// Mock for react-native-screens
const React = require('react');
const { View } = require('react-native');

const Screen = ({ children, ...props }) =>
  React.createElement(View, props, children);

const ScreenStack = ({ children, ...props }) =>
  React.createElement(View, props, children);

module.exports = {
  enableScreens: jest.fn(),
  Screen,
  ScreenStack,
  ScreenStackHeaderConfig: ({ children, ...props }) =>
    React.createElement(View, props, children),
};
