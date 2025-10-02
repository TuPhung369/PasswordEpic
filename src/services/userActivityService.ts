import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppState,
  AppStateStatus,
  NativeEventSubscription,
} from 'react-native';

export interface UserActivityConfig {
  inactivityTimeout: number; // in minutes
  trackUserInteraction: boolean;
}

export interface ActivityInfo {
  lastUserInteraction: number;
  lastAppState: AppStateStatus;
  isUserActive: boolean;
  timeUntilAutoLock: number;
  shouldLock?: boolean; // Flag to indicate if auto-lock should be triggered
}

export type ActivityCallback = (activityInfo: ActivityInfo) => void;

export class UserActivityService {
  private static instance: UserActivityService;
  private config: UserActivityConfig;
  private lastUserInteraction: number = Date.now();
  private lastAppState: AppStateStatus = 'active';
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private activityCallbacks: Set<ActivityCallback> = new Set();
  private appStateSubscription: NativeEventSubscription | null = null;
  private isTracking: boolean = false;
  private recordInteractionDebounceTimer: ReturnType<typeof setTimeout> | null =
    null;
  private isAppInForeground: boolean = true;

  // Storage keys
  private readonly LAST_INTERACTION_KEY = 'user_last_interaction';
  private readonly ACTIVITY_CONFIG_KEY = 'user_activity_config';

  private constructor() {
    this.config = {
      inactivityTimeout: 5, // 5 minutes default
      trackUserInteraction: true,
    };
  }

  public static getInstance(): UserActivityService {
    if (!UserActivityService.instance) {
      UserActivityService.instance = new UserActivityService();
    }
    return UserActivityService.instance;
  }

  /**
   * Initialize the service and restore previous state
   */
  public async initialize(): Promise<void> {
    try {
      // Load config from storage
      const configStr = await AsyncStorage.getItem(this.ACTIVITY_CONFIG_KEY);
      if (configStr) {
        const savedConfig = JSON.parse(configStr);
        this.config = { ...this.config, ...savedConfig };
      }

      // Load last interaction time
      const lastInteractionStr = await AsyncStorage.getItem(
        this.LAST_INTERACTION_KEY,
      );
      if (lastInteractionStr) {
        this.lastUserInteraction = parseInt(lastInteractionStr, 10);
      } else {
        this.lastUserInteraction = Date.now();
        await this.saveLastInteraction();
      }

      console.log('🎯 UserActivityService initialized:', {
        timeout: this.config.inactivityTimeout,
        lastInteraction: new Date(
          this.lastUserInteraction,
        ).toLocaleTimeString(),
      });
    } catch (error) {
      console.error('Failed to initialize UserActivityService:', error);
    }
  }

  /**
   * Start tracking user activity
   */
  public async startTracking(): Promise<void> {
    if (this.isTracking) {
      console.log('🎯 Already tracking user activity');
      return;
    }

    console.log('🎯 Starting user activity tracking...');
    this.isTracking = true;

    // Update interaction time to now
    this.lastUserInteraction = Date.now();
    await this.saveLastInteraction();

    // Setup app state listener
    this.setupAppStateListener();

    // Start inactivity timer
    this.startInactivityTimer();

    console.log('🎯 User activity tracking started');
  }

  /**
   * Stop tracking user activity
   */
  public stopTracking(): void {
    if (!this.isTracking) return;

    console.log('🎯 Stopping user activity tracking...');
    this.isTracking = false;

    // Clear inactivity timer
    this.clearInactivityTimer();

    // Remove app state listener
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    console.log('🎯 User activity tracking stopped');
  }

  /**
   * Update user interaction timestamp (with debounce to avoid excessive calls)
   */
  public async recordUserInteraction(): Promise<void> {
    if (!this.isTracking || !this.config.trackUserInteraction) return;

    // Clear existing debounce timer
    if (this.recordInteractionDebounceTimer) {
      clearTimeout(this.recordInteractionDebounceTimer);
    }

    const now = Date.now();
    this.lastUserInteraction = now;

    // Debounce the actual processing (save to storage, restart timer, notify)
    // This prevents excessive calls when user is actively touching the screen
    this.recordInteractionDebounceTimer = setTimeout(async () => {
      try {
        await this.saveLastInteraction();

        // Restart inactivity timer
        this.startInactivityTimer();

        // Also update session activity to prevent session timeout
        // This ensures session extends when user is actively using the app
        try {
          const { default: SessionService } = await import('./sessionService');
          const sessionService = SessionService.getInstance();
          await sessionService.updateActivity();
        } catch (error) {
          console.error('Failed to update session activity:', error);
        }

        // Notify callbacks
        this.notifyCallbacks();

        console.log(
          '🎯 User interaction recorded:',
          new Date(now).toLocaleTimeString(),
        );
      } catch (error) {
        console.error('Failed to record user interaction:', error);
      }
    }, 500); // 500ms debounce - adjust as needed
  }

  /**
   * Update configuration
   */
  public async updateConfig(
    newConfig: Partial<UserActivityConfig>,
  ): Promise<void> {
    const oldTimeout = this.config.inactivityTimeout;
    this.config = { ...this.config, ...newConfig };

    try {
      await AsyncStorage.setItem(
        this.ACTIVITY_CONFIG_KEY,
        JSON.stringify(this.config),
      );

      // Only restart timer if timeout value actually changed
      const timeoutChanged = oldTimeout !== this.config.inactivityTimeout;
      if (this.isTracking && timeoutChanged) {
        console.log(
          `🎯 Timeout changed from ${oldTimeout} to ${this.config.inactivityTimeout} minutes - restarting timer`,
        );
        this.startInactivityTimer();
      }

      console.log('🎯 Activity config updated:', this.config);
    } catch (error) {
      console.error('Failed to update activity config:', error);
    }
  }

  /**
   * Get current activity information
   */
  public getActivityInfo(shouldLock: boolean = false): ActivityInfo {
    const now = Date.now();
    const timeSinceInteraction = now - this.lastUserInteraction;
    const timeoutMs = this.config.inactivityTimeout * 60 * 1000;
    const timeUntilAutoLock = Math.max(0, timeoutMs - timeSinceInteraction);

    return {
      lastUserInteraction: this.lastUserInteraction,
      lastAppState: this.lastAppState,
      isUserActive: timeSinceInteraction < timeoutMs,
      timeUntilAutoLock,
      shouldLock,
    };
  }

  /**
   * Check if user should be auto-locked based on inactivity
   */
  public shouldAutoLock(): boolean {
    const activityInfo = this.getActivityInfo();
    return !activityInfo.isUserActive && this.isTracking;
  }

  /**
   * Subscribe to activity changes
   */
  public subscribe(callback: ActivityCallback): () => void {
    this.activityCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.activityCallbacks.delete(callback);
    };
  }

  /**
   * Get time until auto-lock (in milliseconds)
   */
  public getTimeUntilAutoLock(): number {
    return this.getActivityInfo().timeUntilAutoLock;
  }

  /**
   * Force trigger auto-lock callback
   */
  public triggerAutoLock(): void {
    console.log('🎯 Triggering auto-lock due to inactivity');
    this.notifyCallbacks(true); // Pass true to indicate lock should be triggered
  }

  // Private methods

  private setupAppStateListener(): void {
    // Remove existing subscription
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }

    this.appStateSubscription = AppState.addEventListener(
      'change',
      nextAppState => {
        const previousState = this.lastAppState;
        this.lastAppState = nextAppState;

        console.log(`🎯 App state changed: ${previousState} → ${nextAppState}`);

        // Track if app is in foreground
        this.isAppInForeground = nextAppState === 'active';

        if (nextAppState === 'active' && previousState !== 'active') {
          console.log('🎯 App became active from background');

          // Check if we should auto-lock based on time spent in background
          const now = Date.now();
          const timeSinceLastInteraction = now - this.lastUserInteraction;
          const timeoutMs = this.config.inactivityTimeout * 60 * 1000;

          if (timeSinceLastInteraction >= timeoutMs) {
            console.log(
              `🎯 App was in background for ${Math.round(
                timeSinceLastInteraction / 1000,
              )}s, triggering auto-lock`,
            );
            this.triggerAutoLock();
          } else {
            console.log(
              `🎯 App was in background for ${Math.round(
                timeSinceLastInteraction / 1000,
              )}s, no auto-lock needed`,
            );
            // Restart timer for remaining time
            this.startInactivityTimer();
          }
        } else if (nextAppState !== 'active') {
          console.log('🎯 App went to background, pausing inactivity timer');
          // Don't clear the timer, just let it continue
          // This way if user is away for too long, they'll be locked when returning
        }
      },
    );
  }

  private startInactivityTimer(): void {
    this.clearInactivityTimer();

    if (!this.isTracking) return;

    const timeoutMs = this.config.inactivityTimeout * 60 * 1000;

    console.log(
      `🎯 Starting inactivity timer: ${this.config.inactivityTimeout} minutes`,
    );

    this.inactivityTimer = setTimeout(() => {
      // Only trigger auto-lock if app is in foreground
      // If app is in background, the lock will be triggered when app returns to foreground
      if (this.isAppInForeground) {
        console.log(
          '🎯 Inactivity timeout reached while app in foreground - triggering auto-lock',
        );
        this.triggerAutoLock();
      } else {
        console.log(
          '🎯 Inactivity timeout reached but app in background - will check on resume',
        );
      }
    }, timeoutMs);
  }

  private clearInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    if (this.recordInteractionDebounceTimer) {
      clearTimeout(this.recordInteractionDebounceTimer);
      this.recordInteractionDebounceTimer = null;
    }
  }

  private async saveLastInteraction(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.LAST_INTERACTION_KEY,
        this.lastUserInteraction.toString(),
      );
    } catch (error) {
      console.error('Failed to save last interaction:', error);
    }
  }

  private notifyCallbacks(shouldLock: boolean = false): void {
    const activityInfo = this.getActivityInfo(shouldLock);
    this.activityCallbacks.forEach(callback => {
      try {
        callback(activityInfo);
      } catch (error) {
        console.error('Error in activity callback:', error);
      }
    });
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.stopTracking();
    this.activityCallbacks.clear();
  }
}
