// React Navigation mock for Jest
const React = require('react');

const NavigationContainer = ({ children }) => children;

const MockNavigator = ({ children }) => children;
const MockScreen = () => null;

const createStackNavigator = () => ({
  Navigator: MockNavigator,
  Screen: MockScreen,
});

const createNativeStackNavigator = () => ({
  Navigator: MockNavigator,
  Screen: MockScreen,
});

const createBottomTabNavigator = () => ({
  Navigator: MockNavigator,
  Screen: MockScreen,
});

const createDrawerNavigator = () => ({
  Navigator: MockNavigator,
  Screen: MockScreen,
});

module.exports = {
  NavigationContainer,
  createNativeStackNavigator,
  createStackNavigator,
  createBottomTabNavigator,
  createDrawerNavigator,
};
