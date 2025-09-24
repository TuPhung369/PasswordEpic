import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import passwordsReducer from "./slices/passwordsSlice";
import settingsReducer from "./slices/settingsSlice";

const store = configureStore({
  reducer: {
    auth: authReducer,
    passwords: passwordsReducer,
    settings: settingsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["persist/PERSIST"],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export { store };
export default store;

