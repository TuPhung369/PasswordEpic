import React, { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";
import { NavigationContainer } from "@react-navigation/native";
import { store } from "./src/store";
import { AppNavigator } from "./src/navigation/AppNavigator";
// import { initializeFirebase } from "./src/services/firebase";

console.log("App.tsx: Starting to define App component");

const App: React.FC = () => {
  console.log("App.tsx: App component function called");
  useEffect(() => {
    // Initialize Firebase when app starts
    // Temporarily disabled to debug runtime issues
    // initializeFirebase();
    console.log("App initialized - Firebase disabled for debugging");
  }, []);

  console.log("App.tsx: About to render App component");
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <NavigationContainer linking={undefined}>
          <AppNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </Provider>
  );
};

console.log("App.tsx: App component defined, about to export");
export default App;

