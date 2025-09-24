/**
 * @format
 */

// Import polyfills FIRST, before any other imports
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";

console.log("Starting app initialization...");
console.log("Polyfills imported");

import { AppRegistry } from "react-native";
console.log("AppRegistry imported");

import App from "./App";
console.log("App component imported");

console.log("Registering components...");
AppRegistry.registerComponent("PasswordEpic", () => App);
AppRegistry.registerComponent("main", () => App);
console.log("Both PasswordEpic and main components registered successfully!");

