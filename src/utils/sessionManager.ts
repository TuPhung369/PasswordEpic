import { AppState, AppStateStatus } from 'react-native';
import { sessionCache } from '../utils/sessionCache';

class SessionManager {
  private appStateSubscription: any;
  private lastActiveTime: number = Date.now();
  private readonly INACTIVE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  init() {
    // Subscribe to app state changes
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange,
    );
    this.lastActiveTime = Date.now();
  }

  cleanup() {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    const now = Date.now();

    if (nextAppState === 'active') {
      // Check if app was inactive for too long
      const inactiveTime = now - this.lastActiveTime;
      if (inactiveTime > this.INACTIVE_TIMEOUT) {
        console.log(
          `🧹 SessionManager: App inactive for ${Math.round(
            inactiveTime / 1000,
          )}s, clearing session cache`,
        );
        this.clearSensitiveData();
      }
      this.lastActiveTime = now;
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      // 🔒 MODIFIED: Don't clear cache immediately on background
      // Only clear after extended inactivity for better UX
      console.log(
        '🔒 SessionManager: App backgrounded - cache will clear after timeout',
      );
      // Remove immediate cache clear: this.clearSensitiveData();
      this.lastActiveTime = now;
    }
  };

  private clearSensitiveData() {
    // Clear master password from session cache
    sessionCache.clear();
  }

  // Manual logout - clear all cached data
  logout() {
    console.log('👋 SessionManager: User logout, clearing all session data');
    this.clearSensitiveData();
  }

  // Check if app has been inactive too long
  isSessionExpired(): boolean {
    const now = Date.now();
    return now - this.lastActiveTime > this.INACTIVE_TIMEOUT;
  }
}

export const sessionManager = new SessionManager();
