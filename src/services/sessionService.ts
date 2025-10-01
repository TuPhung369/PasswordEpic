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
      timeout: 15, // 15 minutes default
      warningTime: 2, // 2 minutes warning
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
          '🔐 SessionService: Adjusted config for timeout:',
          this.config.timeout,
          'warningTime:',
          this.config.warningTime,
        );
        await this.saveConfig();
      }

      this.lastActivity = Date.now();
      this.isActive = true;

      // Save session start time
      await AsyncStorage.setItem(
        this.SESSION_LAST_ACTIVITY,
        this.lastActivity.toString(),
      );

      // Start session timer
      this.startTimer();

      console.log(
        'Session started with timeout:',
        this.config.timeout,
        'minutes',
      );
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
    if (!this.isActive) return;

    try {
      this.lastActivity = Date.now();

      // Save to storage
      await AsyncStorage.setItem(
        this.SESSION_LAST_ACTIVITY,
        this.lastActivity.toString(),
      );

      // Restart timer if extend on activity is enabled
      if (this.config.extendOnActivity) {
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
    if (!this.isActive) return;

    try {
      this.lastActivity = Date.now();

      // Save extended time
      await AsyncStorage.setItem(
        this.SESSION_LAST_ACTIVITY,
        this.lastActivity.toString(),
      );

      // Restart timer
      this.startTimer();

      console.log('Session extended by', minutes, 'minutes');
    } catch (error) {
      console.error('Failed to extend session:', error);
    }
  }

  /**
   * Update session configuration
   */
  public async updateConfig(config: Partial<SessionConfig>): Promise<void> {
    try {
      this.config = { ...this.config, ...config };
      await this.saveConfig();

      console.log('🔐 SessionService: Config updated:', this.config);

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
      // Load last activity from storage
      const lastActivityStr = await AsyncStorage.getItem(
        this.SESSION_LAST_ACTIVITY,
      );

      if (!lastActivityStr) {
        return false; // No active session
      }

      const lastActivity = parseInt(lastActivityStr, 10);
      const now = Date.now();
      const timeInBackground = now - this.backgroundTime;
      const timeSinceActivity = now - lastActivity;

      // Check if session expired
      const sessionTimeout = this.config.timeout * 60 * 1000;

      if (timeSinceActivity >= sessionTimeout) {
        // Session expired
        await this.handleSessionExpiry();
        return false;
      }

      // Check background lock policy
      if (this.config.lockOnBackground && timeInBackground > 30000) {
        // 30 seconds
        // Auto-lock after background time
        await this.handleSessionExpiry();
        return false;
      }

      // Session is still valid
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

    console.log('🔐 SessionService startTimer:', {
      timeoutMinutes: this.config.timeout,
      warningTimeSeconds: warningTimeInSeconds * 60,
      warningMs,
      timeoutMs,
    });

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
    if (!this.isActive) return;

    const timeRemaining = this.getTimeUntilExpiry();
    const minutesRemaining = Math.ceil(timeRemaining / (60 * 1000));

    console.log(
      '🔐 SessionService: Session warning triggered, timeout:',
      this.config.timeout,
      'warningTime:',
      this.config.warningTime,
      'minutesRemaining:',
      minutesRemaining,
    );

    // Only show warning if we have meaningful time remaining
    if (minutesRemaining > 0) {
      // Dispatch session warning to Redux
      store.dispatch(
        setSessionExpired({
          warning: true,
          expired: false,
          timeRemaining: minutesRemaining,
        }),
      );
    }
  }

  private async handleSessionExpiry(): Promise<void> {
    console.log('Session expired');

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
      // App going to background
      this.backgroundTime = Date.now();

      if (this.config.lockOnBackground) {
        // Immediate lock on background
        setTimeout(() => {
          this.handleSessionExpiry();
        }, 100);
      }
    } else if (nextAppState === 'active') {
      // App becoming active
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
