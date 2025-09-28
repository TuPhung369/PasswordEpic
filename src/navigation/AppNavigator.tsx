import React, { useEffect } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthNavigator } from "./AuthNavigator";
import { MainNavigator } from "./MainNavigator";
import { useAppSelector, useAppDispatch } from "../hooks/redux";
import { onAuthStateChanged } from "../services/authService";
import {
  loginSuccess,
  logout,
  setMasterPasswordConfigured,
  setBiometricEnabled,
} from "../store/slices/authSlice";
import {
  isMasterPasswordSet,
  isBiometricEnabled,
} from "../services/secureStorageService";

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, masterPasswordConfigured } = useAppSelector(
    (state) => state.auth
  );

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(async (user) => {
      if (user) {
        // User is signed in
        dispatch(
          loginSuccess({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
          })
        );

        // Check master password and biometric status
        try {
          const masterPasswordSet = await isMasterPasswordSet();
          const biometricEnabled = await isBiometricEnabled();

          dispatch(setMasterPasswordConfigured(masterPasswordSet));
          dispatch(setBiometricEnabled(biometricEnabled));
        } catch (error) {
          console.error("Failed to check security settings:", error);
        }
      } else {
        // User is signed out
        dispatch(logout());
      }
    });

    // Cleanup subscription on unmount
    return unsubscribe;
  }, [dispatch]);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated && masterPasswordConfigured ? (
        <Stack.Screen name="Main" component={MainNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
};

