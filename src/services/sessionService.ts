import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { store } from '../store';
import { logout, setSessionExpired } from '../store/slices/authSlice';

export interface SessionConfig {
  timeout: number; // in minutes
  warningTime: number; // in minutes before timeout
  extendOnActivity: boolean;
  lockOnBackground: boolean;
}

export interface SessionInfo {
  isActive: boolean;
  lastActivity: number;
  expiresAt: number;
  timeRemaining: number;
}

export class SessionService {
  private static instance: SessionService;
  private sessionTimer: ReturnType<typeof setTimeout> | null = null;
  private warningTimer: ReturnType<typeof setTimeout> | null = null;
  private lastActivity: number = Date.now();
  private isActive: boolean = false;
  private config: SessionConfig;
  private appStateSubscription: any = null;
  private backgroundTime: number = 0;

  // Storage keys
  private readonly SESSION_LAST_ACTIVITY = 'session_last_activity';
  private readonly SESSION_CONFIG = 'session_config';

  private constructor() {
    this.config = {
      timeout: 10080, // 7 days default (7 * 24 * 60 minutes)
      warningTime: 2, // 2 minutes warning (not used)
      extendOnActivity: true,
      lockOnBackground: true,
    };

    this.setupAppStateListener();
  }

  public static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  /**
   * Start session with authentication
   */
  public async startSession(config?: Partial<SessionConfig>): Promise<void> {
    try {
      console.log('🔐 SessionService: Starting session with config:', config);
      console.log(
        '🔐 SessionService: Current config before update:',
        this.config,
      );

      // Update config if provided
      if (config) {
        this.config = { ...this.config, ...config };

        // Adjust warning time based on timeout
        // For very short timeouts, use 10 seconds warning
        if (this.config.timeout <= 1) {
          this.config.warningTime = 10 / 60; // 10 seconds in minutes
        } else if (this.config.timeout <= 2) {
          this.config.warningTime = 0.5; // 30 seconds
        } else {
          this.config.warningTime = Math.min(2, this.config.timeout * 0.3); // 30% of timeout, max 2 minutes
        }

        console.log(
          '🔐 SessionService: Final config after update:',
          this.config,
        );

        // Config adjusted for timeout and warning time
        await this.saveConfig();
      }

      this.lastActivity = Date.now();
      this.isActive = true;

      // Reset background time to prevent stale background lock checks
      // This ensures that after unlock, the background timer starts fresh
      this.backgroundTime = 0;

      // Save session start time
      await AsyncStorage.setItem(
        this.SESSION_LAST_ACTIVITY,
        this.lastActivity.toString(),
      );

      // Start session timer
      this.startTimer();

      // 🔥 COMMENTED OUT FOR DEBUGGING NAVIGATION
      // console.log(`Session started with ${this.config.timeout} minute timeout`);
    } catch (error) {
      console.error('Failed to start session:', error);
      throw error;
    }
  }

  /**
   * End session and cleanup
   */
  public async endSession(): Promise<void> {
    try {
      this.clearTimers();
      this.isActive = false;

      // Clear session data
      await AsyncStorage.removeItem(this.SESSION_LAST_ACTIVITY);

      console.log('Session ended');
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  }

  /**
   * Update last activity timestamp
   */
  public async updateActivity(): Promise<void> {
    if (!this.isActive) {
      console.log('🔐 Session not active, skipping activity update');
      return;
    }

    try {
      this.lastActivity = Date.now();

      // Save to storage
      await AsyncStorage.setItem(
        this.SESSION_LAST_ACTIVITY,
        this.lastActivity.toString(),
      );

      // Restart timer if extend on activity is enabled
      if (this.config.extendOnActivity) {
        // console.log('🔐 Session extended due to user activity');
        this.startTimer();
      }
    } catch (error) {
      console.error('Failed to update activity:', error);
    }
  }

  /**
   * Get current session info
   */
  public getSessionInfo(): SessionInfo {
    const now = Date.now();
    const expiresAt = this.lastActivity + this.config.timeout * 60 * 1000;
    const timeRemaining = Math.max(0, expiresAt - now);

    return {
      isActive: this.isActive,
      lastActivity: this.lastActivity,
      expiresAt,
      timeRemaining,
    };
  }

  /**
   * Check if session has expired
   */
  public isSessionExpired(): boolean {
    if (!this.isActive) return true;

    const now = Date.now();
    const expiresAt = this.lastActivity + this.config.timeout * 60 * 1000;

    return now >= expiresAt;
  }

  /**
   * Get time until session expires (in milliseconds)
   */
  public getTimeUntilExpiry(): number {
    const sessionInfo = this.getSessionInfo();
    return sessionInfo.timeRemaining;
  }

  /**
   * Extend session by specified minutes
   */
  public async extendSession(minutes: number = 15): Promise<void> {
    if (!this.isActive) {
      console.log('🔐 Session not active, cannot extend');
      return;
    }

    try {
      // IMMEDIATELY clear any existing timers to prevent expiry during extension
      this.clearTimers();

      // Update activity timestamp
      this.lastActivity = Date.now();

      // Save extended time to storage
      await AsyncStorage.setItem(
        this.SESSION_LAST_ACTIVITY,
        this.lastActivity.toString(),
      );

      // Restart timer with fresh timeout
      this.startTimer();

      console.log(
        '🔐 Session extended by',
        minutes,
        'minutes, new expiry:',
        new Date(this.lastActivity + this.config.timeout * 60 * 1000),
      );
    } catch (error) {
      console.error('Failed to extend session:', error);
      // Even if storage fails, keep the session active in memory
      this.startTimer();
    }
  }

  /**
   * Extend session immediately (synchronous timer reset)
   * Use this for critical operations like auto-lock where we need to prevent race conditions
   */
  public extendSessionImmediate(minutes: number = 15): void {
    if (!this.isActive) {
      console.log('🔐 Session not active, cannot extend immediately');
      return;
    }

    console.log('🔐 Extending session immediately to prevent expiry');

    // IMMEDIATELY clear any existing timers to prevent expiry
    this.clearTimers();

    // Update activity timestamp immediately
    this.lastActivity = Date.now();

    // Restart timer immediately
    this.startTimer();

    // Save to storage asynchronously (non-blocking)
    AsyncStorage.setItem(
      this.SESSION_LAST_ACTIVITY,
      this.lastActivity.toString(),
    ).catch(error => {
      console.error('Failed to save extended session to storage:', error);
    });

    console.log(
      '🔐 Session extended immediately by',
      minutes,
      'minutes, new expiry:',
      new Date(this.lastActivity + this.config.timeout * 60 * 1000),
    );
  }

  /**
   * Update session configuration
   */
  public async updateConfig(config: Partial<SessionConfig>): Promise<void> {
    try {
      this.config = { ...this.config, ...config };
      await this.saveConfig();

      // Session config updated

      // Restart timer with new config
      if (this.isActive) {
        this.startTimer();
      }
    } catch (error) {
      console.error('Failed to update session config:', error);
    }
  }

  /**
   * Get session configuration
   */
  public getConfig(): SessionConfig {
    return { ...this.config };
  }

  /**
   * Check session on app resume
   */
  public async checkSessionOnResume(): Promise<boolean> {
    try {
      const now = Date.now();
      const timeInBackground =
        this.backgroundTime > 0 ? now - this.backgroundTime : 0;

      console.log('🔐 SessionService: Checking session on resume', {
        timeInBackground: Math.round(timeInBackground / 1000) + 's',
        lockOnBackground: this.config.lockOnBackground,
        isActive: this.isActive,
      });

      // Check background lock policy FIRST
      // If lockOnBackground is enabled and app was in background > 30 seconds, require re-authentication
      if (this.config.lockOnBackground && timeInBackground > 30000) {
        console.log(
          '🔐 SessionService: Background time exceeded 30s, requiring re-authentication',
        );
        // Don't call handleSessionExpiry here - just return false to trigger biometric
        // This preserves the session but requires re-authentication
        return false;
      }

      // Load last activity from storage
      const lastActivityStr = await AsyncStorage.getItem(
        this.SESSION_LAST_ACTIVITY,
      );

      if (!lastActivityStr) {
        console.log('🔐 SessionService: No active session found');
        return false; // No active session
      }

      const lastActivity = parseInt(lastActivityStr, 10);
      const timeSinceActivity = now - lastActivity;

      // Check if session expired due to inactivity timeout
      const sessionTimeout = this.config.timeout * 60 * 1000;

      if (timeSinceActivity >= sessionTimeout) {
        console.log('🔐 SessionService: Session expired due to timeout');
        // Session expired - clear it
        await this.handleSessionExpiry();
        return false;
      }

      // Session is still valid - restore it
      console.log('🔐 SessionService: Session is valid, restoring...');
      this.lastActivity = lastActivity;
      this.isActive = true;
      this.startTimer();

      return true;
    } catch (error) {
      console.error('Failed to check session on resume:', error);
      return false;
    }
  }

  /**
   * Force session expiry
   */
  public async forceExpiry(): Promise<void> {
    await this.handleSessionExpiry();
  }

  /**
   * Get authentication requirement based on session state and background time
   * This helps determine whether to show biometric, require full login, or allow access
   */
  public async getAuthenticationRequirement(): Promise<{
    type: 'none' | 'biometric' | 'fullLogin';
    reason: string;
    sessionValid: boolean;
  }> {
    try {
      // Load last activity from storage
      const lastActivityStr = await AsyncStorage.getItem(
        this.SESSION_LAST_ACTIVITY,
      );

      // No session data = require full login
      if (!lastActivityStr || !this.isActive) {
        return {
          type: 'fullLogin',
          reason: 'no_active_session',
          sessionValid: false,
        };
      }

      const lastActivity = parseInt(lastActivityStr, 10);
      const now = Date.now();
      const timeInBackground =
        this.backgroundTime > 0 ? now - this.backgroundTime : 0;
      const timeSinceActivity = now - lastActivity;
      const sessionTimeout = this.config.timeout * 60 * 1000;

      // Check if session expired due to inactivity
      if (timeSinceActivity >= sessionTimeout) {
        return {
          type: 'fullLogin',
          reason: 'session_expired',
          sessionValid: false,
        };
      }

      // Check background lock policy
      if (this.config.lockOnBackground && timeInBackground > 30000) {
        // For lockOnBackground, require biometric after 30 seconds
        // Session is still valid, just need re-authentication
        return {
          type: 'biometric',
          reason: 'background_lock_policy',
          sessionValid: true, // Session is technically valid, but policy requires re-auth
        };
      }

      // Session is valid - allow biometric for quick unlock
      // But only if we've been in background (otherwise no auth needed)
      if (timeInBackground > 1000) {
        // 1 second threshold for actual background
        return {
          type: 'biometric',
          reason: 'quick_unlock',
          sessionValid: true,
        };
      }

      // No authentication needed for very quick switches
      return {
        type: 'none',
        reason: 'quick_switch',
        sessionValid: true,
      };
    } catch (error) {
      console.error('Failed to get authentication requirement:', error);
      return {
        type: 'fullLogin',
        reason: 'error_checking_session',
        sessionValid: false,
      };
    }
  }

  // Private methods

  private startTimer(): void {
    this.clearTimers();

    const timeoutMs = this.config.timeout * 60 * 1000;

    // Calculate adaptive warning time in seconds
    let warningTimeInSeconds: number;
    if (this.config.timeout <= 1) {
      // For very short timeouts (≤ 1 minute), show warning 10 seconds before
      warningTimeInSeconds = 10 / 60; // 10 seconds in minutes
    } else if (this.config.timeout <= 2) {
      // For short timeouts (≤ 2 minutes), show warning 30 seconds before
      warningTimeInSeconds = 30 / 60; // 30 seconds in minutes
    } else {
      // For longer timeouts, show warning 30% before expiry (max 2 minutes)
      const thirtyPercent = this.config.timeout * 0.3;
      warningTimeInSeconds = Math.min(thirtyPercent, 2);
    }

    const warningMs = (this.config.timeout - warningTimeInSeconds) * 60 * 1000;

    // Session timer started

    // Set warning timer
    if (warningTimeInSeconds > 0 && warningMs > 0) {
      this.warningTimer = setTimeout(() => {
        this.handleSessionWarning();
      }, warningMs);
    }

    // Set expiry timer
    this.sessionTimer = setTimeout(() => {
      this.handleSessionExpiry();
    }, timeoutMs);
  }

  private clearTimers(): void {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }

    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
  }

  private handleSessionWarning(): void {
    // Session warnings are disabled - auto expire without warning
    console.log(
      '🔐 SessionService: Session warning disabled, will auto-expire on timeout',
    );
    return;
  }

  private async handleSessionExpiry(): Promise<void> {
    console.log('🔐 SessionService: Session expired naturally');

    // Add some debug info about when this happened
    const debugInfo = this.getDebugInfo();
    console.log('🔐 SessionService: Session expiry debug info:', {
      timeSinceActivity: Math.round(debugInfo.timeSinceActivity / 1000) + 's',
      sessionTimeout: Math.round(debugInfo.sessionTimeout / 1000) + 's',
      timeInBackground: Math.round(debugInfo.timeInBackground / 1000) + 's',
      config: debugInfo.config,
    });

    this.clearTimers();
    this.isActive = false;

    // Clear session data
    await AsyncStorage.removeItem(this.SESSION_LAST_ACTIVITY);

    // Dispatch logout to Redux
    store.dispatch(logout());
    store.dispatch(
      setSessionExpired({
        expired: true,
        warning: false,
        timeRemaining: 0,
      }),
    );
  }

  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this),
    );
  }

  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App going to background - just record the time
      // Don't lock immediately to allow quick app switches
      this.backgroundTime = Date.now();
      console.log(
        '🔐 SessionService: App went to background at',
        new Date(this.backgroundTime).toLocaleTimeString(),
      );
    } else if (nextAppState === 'active') {
      // App becoming active - check if we should lock based on background time
      console.log('🔐 SessionService: App became active, checking session...');
      if (this.backgroundTime > 0) {
        this.checkSessionOnResume();
      }
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.SESSION_CONFIG,
        JSON.stringify(this.config),
      );
    } catch (error) {
      console.error('Failed to save session config:', error);
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const configStr = await AsyncStorage.getItem(this.SESSION_CONFIG);
      if (configStr) {
        const savedConfig = JSON.parse(configStr);
        this.config = { ...this.config, ...savedConfig };
      }
    } catch (error) {
      console.error('Failed to load session config:', error);
    }
  }

  /**
   * Initialize service (load config, etc.)
   */
  public async initialize(): Promise<void> {
    await this.loadConfig();
  }

  /**
   * Get current session debug info (for testing/debugging)
   */
  public getDebugInfo(): {
    isActive: boolean;
    lastActivity: number;
    backgroundTime: number;
    config: SessionConfig;
    timeInBackground: number;
    timeSinceActivity: number;
    sessionTimeout: number;
  } {
    const now = Date.now();
    return {
      isActive: this.isActive,
      lastActivity: this.lastActivity,
      backgroundTime: this.backgroundTime,
      config: this.config,
      timeInBackground: this.backgroundTime > 0 ? now - this.backgroundTime : 0,
      timeSinceActivity: now - this.lastActivity,
      sessionTimeout: this.config.timeout * 60 * 1000,
    };
  }

  /**
   * Cleanup service
   */
  public cleanup(): void {
    this.clearTimers();
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }
}

export default SessionService;
