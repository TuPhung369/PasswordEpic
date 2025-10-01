import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  SessionService,
  SessionConfig,
  SessionInfo,
} from '../services/sessionService';
import { useAppDispatch, useAppSelector } from './redux';
import {
  logout,
  setSessionExpired,
  clearSession,
} from '../store/slices/authSlice';
import { RootState } from '../store';

export interface UseSessionReturn {
  // State
  isActive: boolean;
  sessionInfo: SessionInfo;
  isWarning: boolean;
  timeRemaining: number;
  config: SessionConfig;

  // Actions
  startSession: (config?: Partial<SessionConfig>) => Promise<void>;
  endSession: () => Promise<void>;
  extendSession: (minutes?: number) => Promise<void>;
  updateActivity: () => Promise<void>;
  updateConfig: (config: Partial<SessionConfig>) => Promise<void>;
  dismissWarning: () => void;
  forceLogout: () => Promise<void>;

  // Utils
  formatTimeRemaining: (milliseconds: number) => string;
  isSessionExpired: () => boolean;
}

export const useSession = (): UseSessionReturn => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, session } = useAppSelector(
    (state: RootState) => state.auth,
  );
  const { security } = useAppSelector((state: RootState) => state.settings);

  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({
    isActive: false,
    lastActivity: Date.now(),
    expiresAt: Date.now(),
    timeRemaining: 0,
  });

  const [config, setConfig] = useState<SessionConfig>({
    timeout: 15,
    warningTime: 2,
    extendOnActivity: true,
    lockOnBackground: true,
  });

  const updateTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>('active');

  /**
   * Initialize session service and load config
   */
  useEffect(() => {
    const initializeSession = async () => {
      try {
        const sessionService = SessionService.getInstance();
        await sessionService.initialize();
        const serviceConfig = sessionService.getConfig();
        setConfig(serviceConfig);
      } catch (error) {
        console.error('Failed to initialize session service:', error);
      }
    };

    initializeSession();
  }, []);

  /**
   * Start session with authentication
   */
  const startSession = useCallback(
    async (sessionConfig?: Partial<SessionConfig>): Promise<void> => {
      try {
        const sessionService = SessionService.getInstance();
        const finalConfig = {
          timeout: security.autoLockTimeout,
          warningTime: 2,
          extendOnActivity: true,
          lockOnBackground: true,
          ...sessionConfig,
        };

        await sessionService.startSession(finalConfig);
        setConfig(finalConfig);

        // Clear any existing session warnings
        dispatch(clearSession());

        console.log('Session started successfully');
      } catch (error) {
        console.error('Failed to start session:', error);
        throw error;
      }
    },
    [dispatch, security.autoLockTimeout],
  );

  /**
   * End session and cleanup
   */
  const endSession = useCallback(async (): Promise<void> => {
    try {
      const sessionService = SessionService.getInstance();
      await sessionService.endSession();
      dispatch(clearSession());
      console.log('Session ended successfully');
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  }, [dispatch]);

  /**
   * Extend session by specified minutes
   */
  const extendSession = useCallback(
    async (minutes: number = 15): Promise<void> => {
      try {
        const sessionService = SessionService.getInstance();
        await sessionService.extendSession(minutes);
        dispatch(clearSession()); // Clear warnings
        console.log('Session extended by', minutes, 'minutes');
      } catch (error) {
        console.error('Failed to extend session:', error);
        throw error;
      }
    },
    [dispatch],
  );

  /**
   * Update last activity timestamp
   */
  const updateActivity = useCallback(async (): Promise<void> => {
    try {
      const sessionService = SessionService.getInstance();
      await sessionService.updateActivity();
    } catch (error) {
      console.error('Failed to update activity:', error);
    }
  }, []);

  /**
   * Update session configuration
   */
  const updateConfig = useCallback(
    async (newConfig: Partial<SessionConfig>): Promise<void> => {
      try {
        const sessionService = SessionService.getInstance();
        await sessionService.updateConfig(newConfig);
        const updatedConfig = sessionService.getConfig();
        setConfig(updatedConfig);
        console.log('Session config updated:', updatedConfig);
      } catch (error) {
        console.error('Failed to update session config:', error);
        throw error;
      }
    },
    [],
  );

  /**
   * Update session timeout based on security settings
   */
  useEffect(() => {
    if (security.autoLockTimeout !== config.timeout) {
      const newConfig = {
        ...config,
        timeout: security.autoLockTimeout,
      };
      setConfig(newConfig);
      updateConfig(newConfig);
    }
  }, [security.autoLockTimeout, config, updateConfig]);

  /**
   * Dismiss session warning
   */
  const dismissWarning = useCallback((): void => {
    console.log('🔐 useSession: dismissWarning called');
    dispatch(
      setSessionExpired({ warning: false, expired: false, timeRemaining: 0 }),
    );
  }, [dispatch]);

  /**
   * Force logout immediately
   */
  const forceLogout = useCallback(async (): Promise<void> => {
    try {
      const sessionService = SessionService.getInstance();
      await sessionService.forceExpiry();
      dispatch(logout());
      dispatch(clearSession());
      console.log('Forced logout completed');
    } catch (error) {
      console.error('Failed to force logout:', error);
    }
  }, [dispatch]);

  /**
   * Format time remaining for display
   */
  const formatTimeRemaining = useCallback((milliseconds: number): string => {
    if (milliseconds <= 0) return '0:00';

    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  /**
   * Check if session has expired
   */
  const isSessionExpired = useCallback((): boolean => {
    const sessionService = SessionService.getInstance();
    return sessionService.isSessionExpired();
  }, []);

  /**
   * Update session info periodically
   */
  const updateSessionInfo = useCallback(() => {
    if (isAuthenticated) {
      const sessionService = SessionService.getInstance();
      const info = sessionService.getSessionInfo();
      setSessionInfo(info);

      // Handle session expiry
      if (info.timeRemaining <= 0 && info.isActive) {
        dispatch(logout());
        dispatch(
          setSessionExpired({
            expired: true,
            warning: false,
            timeRemaining: 0,
          }),
        );
      }
      // Handle session warning
      else if (
        info.timeRemaining <= config.warningTime * 60 * 1000 &&
        info.isActive &&
        !session.warning
      ) {
        const minutesRemaining = Math.ceil(info.timeRemaining / (60 * 1000));
        dispatch(
          setSessionExpired({
            warning: true,
            expired: false,
            timeRemaining: minutesRemaining,
          }),
        );
      }
    }
  }, [isAuthenticated, dispatch, config.warningTime, session.warning]);

  /**
   * Handle app state changes
   */
  const handleAppStateChange = useCallback(
    async (nextAppState: AppStateStatus) => {
      const previousAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (previousAppState === 'background' && nextAppState === 'active') {
        // App coming to foreground
        if (isAuthenticated) {
          const sessionService = SessionService.getInstance();
          const isValid = await sessionService.checkSessionOnResume();
          if (!isValid) {
            dispatch(logout());
            dispatch(
              setSessionExpired({
                expired: true,
                warning: false,
                timeRemaining: 0,
              }),
            );
          } else {
            // Session is valid, update activity
            await updateActivity();
          }
        }
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App going to background
        if (config.lockOnBackground && isAuthenticated) {
          // Immediate lock on background if configured
          setTimeout(async () => {
            await forceLogout();
          }, 1000); // 1 second delay to allow for quick app switches
        }
      }
    },
    [
      isAuthenticated,
      config.lockOnBackground,
      dispatch,
      updateActivity,
      forceLogout,
    ],
  );

  /**
   * Setup periodic updates and app state listener
   */
  useEffect(() => {
    if (isAuthenticated) {
      // Update session info immediately
      updateSessionInfo();

      // Set up periodic updates (every second)
      updateTimer.current = setInterval(updateSessionInfo, 1000);

      // Listen for app state changes
      const subscription = AppState.addEventListener(
        'change',
        handleAppStateChange,
      );

      return () => {
        if (updateTimer.current) {
          clearInterval(updateTimer.current);
          updateTimer.current = null;
        }
        subscription?.remove();
      };
    } else {
      // Clear timer when not authenticated
      if (updateTimer.current) {
        clearInterval(updateTimer.current);
        updateTimer.current = null;
      }

      // Reset session info
      setSessionInfo({
        isActive: false,
        lastActivity: Date.now(),
        expiresAt: Date.now(),
        timeRemaining: 0,
      });
    }
  }, [isAuthenticated, updateSessionInfo, handleAppStateChange]);

  /**
   * Start session automatically when user authenticates
   */
  useEffect(() => {
    if (isAuthenticated && !sessionInfo.isActive) {
      startSession();
    } else if (!isAuthenticated && sessionInfo.isActive) {
      endSession();
    }
  }, [isAuthenticated, sessionInfo.isActive, startSession, endSession]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (updateTimer.current) {
        clearInterval(updateTimer.current);
      }
      const sessionService = SessionService.getInstance();
      sessionService.cleanup();
    };
  }, []);

  return {
    // State
    isActive: sessionInfo.isActive,
    sessionInfo,
    isWarning: session.warning,
    timeRemaining: sessionInfo.timeRemaining,
    config,

    // Actions
    startSession,
    endSession,
    extendSession,
    updateActivity,
    updateConfig,
    dismissWarning,
    forceLogout,

    // Utils
    formatTimeRemaining,
    isSessionExpired,
  };
};

export default useSession;
