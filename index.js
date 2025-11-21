/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Ignore specific deprecation warnings
LogBox.ignoreLogs([
  'ProgressBarAndroid has been extracted from react-native core',
  'SafeAreaView has been deprecated',
  'Clipboard has been extracted from react-native core',
  'PushNotificationIOS has been extracted from react-native core',
]);

AppRegistry.registerComponent(appName, () => App);
