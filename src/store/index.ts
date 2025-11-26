import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { combineReducers } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import passwordsReducer from './slices/passwordsSlice';
import settingsReducer from './slices/settingsSlice';

// Persist configuration
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['settings'], // Only persist settings (auth and passwords are handled separately)
  version: 1,
};

// Combine reducers
const rootReducer = combineReducers({
  auth: authReducer,
  passwords: passwordsReducer,
  settings: settingsReducer,
});

// Export the root state type from the non-persisted reducer for proper typing
export type RootState = ReturnType<typeof rootReducer>;

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// For development, we can disable serializable check completely to avoid Date object warnings
// This is safe because we handle serialization properly in our encrypted database service
const isDevelopment = __DEV__;

// Configure store with persisted reducer
const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      // In development, disable serializable check for Date objects
      // In production, it's automatically disabled for performance
      serializableCheck: isDevelopment
        ? false
        : {
            ignoredActions: [
              'persist/PERSIST',
              'persist/REHYDRATE',
              'persist/PAUSE',
              'persist/PURGE',
              'persist/REGISTER',
            ],
          },
      // Disable immutable check for better performance
      immutableCheck: isDevelopment ? false : { warnAfter: 128 },
    }),
});

// Create persistor
export const persistor = persistStore(store);

export type AppDispatch = typeof store.dispatch;

export { store };
export default store;
