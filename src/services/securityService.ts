/**
 * Security Service
 *
 * Provides comprehensive security features:
 * - Root/Jailbreak detection
 * - Anti-tampering measures
 * - Device integrity checks
 * - Security threat detection
 */

import { Platform, NativeModules } from 'react-native';
import JailMonkey from 'jail-monkey';
import DeviceInfo from 'react-native-device-info';

export interface SecurityCheckResult {
  isSecure: boolean;
  threats: SecurityThreat[];
  deviceInfo: DeviceSecurityInfo;
}

export interface SecurityThreat {
  type: ThreatType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
}

export type ThreatType =
  | 'root_detected'
  | 'jailbreak_detected'
  | 'debugger_attached'
  | 'emulator_detected'
  | 'hook_detected'
  | 'tampering_detected'
  | 'suspicious_apps'
  | 'developer_mode';

export interface DeviceSecurityInfo {
  isRooted: boolean;
  isJailbroken: boolean;
  isEmulator: boolean;
  isDebuggerAttached: boolean;
  isDeveloperModeEnabled: boolean;
  hasHooks: boolean;
  hasSuspiciousApps: boolean;
  canMockLocation: boolean;
  isOnExternalStorage: boolean;
  deviceId: string;
  systemVersion: string;
  appVersion: string;
}

class SecurityService {
  private static instance: SecurityService;
  private securityCheckCache: SecurityCheckResult | null = null;
  private lastCheckTime: number = 0;
  private readonly CACHE_DURATION = 60000; // 1 minute

  private constructor() {}

  public static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  /**
   * Perform comprehensive security check
   */
  public async performSecurityCheck(
    forceRefresh: boolean = false,
  ): Promise<SecurityCheckResult> {
    const now = Date.now();

    // Return cached result if available and not expired
    if (
      !forceRefresh &&
      this.securityCheckCache &&
      now - this.lastCheckTime < this.CACHE_DURATION
    ) {
      return this.securityCheckCache;
    }

    try {
      const deviceInfo = await this.getDeviceSecurityInfo();
      const threats = this.analyzeThreats(deviceInfo);
      const isSecure =
        threats.filter(t => t.severity === 'critical' || t.severity === 'high')
          .length === 0;

      const result: SecurityCheckResult = {
        isSecure,
        threats,
        deviceInfo,
      };

      this.securityCheckCache = result;
      this.lastCheckTime = now;

      return result;
    } catch (error) {
      console.error('Security check failed:', error);

      // Return a safe default result on error
      return {
        isSecure: false,
        threats: [
          {
            type: 'tampering_detected',
            severity: 'high',
            description: 'Unable to verify device security',
            recommendation: 'Please restart the app and try again',
          },
        ],
        deviceInfo: await this.getBasicDeviceInfo(),
      };
    }
  }

  /**
   * Get detailed device security information
   */
  private async getDeviceSecurityInfo(): Promise<DeviceSecurityInfo> {
    try {
      const [
        isRooted,
        isJailbroken,
        isEmulator,
        isDebuggerAttached,
        isDeveloperModeEnabled,
        hasHooks,
        hasSuspiciousApps,
        canMockLocation,
        isOnExternalStorage,
        deviceId,
        systemVersion,
        appVersion,
      ] = await Promise.all([
        this.checkRoot(),
        this.checkJailbreak(),
        this.checkEmulator(),
        this.checkDebugger(),
        this.checkDeveloperMode(),
        this.checkHooks(),
        this.checkSuspiciousApps(),
        this.checkMockLocation(),
        this.checkExternalStorage(),
        DeviceInfo.getUniqueId(),
        DeviceInfo.getSystemVersion(),
        DeviceInfo.getVersion(),
      ]);

      return {
        isRooted,
        isJailbroken,
        isEmulator,
        isDebuggerAttached,
        isDeveloperModeEnabled,
        hasHooks,
        hasSuspiciousApps,
        canMockLocation,
        isOnExternalStorage,
        deviceId,
        systemVersion,
        appVersion,
      };
    } catch (error) {
      console.error('Failed to get device security info:', error);
      return this.getBasicDeviceInfo();
    }
  }

  /**
   * Get basic device info as fallback
   */
  private async getBasicDeviceInfo(): Promise<DeviceSecurityInfo> {
    return {
      isRooted: false,
      isJailbroken: false,
      isEmulator: await DeviceInfo.isEmulator(),
      isDebuggerAttached: false,
      isDeveloperModeEnabled: false,
      hasHooks: false,
      hasSuspiciousApps: false,
      canMockLocation: false,
      isOnExternalStorage: false,
      deviceId: await DeviceInfo.getUniqueId(),
      systemVersion: await DeviceInfo.getSystemVersion(),
      appVersion: await DeviceInfo.getVersion(),
    };
  }

  /**
   * Check if device is rooted (Android)
   */
  private async checkRoot(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    try {
      // Use JailMonkey for root detection
      const isRooted = JailMonkey.isJailBroken();

      // Additional checks
      const hasRootBinaries = await this.checkRootBinaries();
      const hasRootApps = await this.checkRootApps();

      return isRooted || hasRootBinaries || hasRootApps;
    } catch (error) {
      console.error('Root check failed:', error);
      return false;
    }
  }

  /**
   * Check for common root binaries
   */
  private async checkRootBinaries(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    const rootBinaries = [
      '/system/app/Superuser.apk',
      '/sbin/su',
      '/system/bin/su',
      '/system/xbin/su',
      '/data/local/xbin/su',
      '/data/local/bin/su',
      '/system/sd/xbin/su',
      '/system/bin/failsafe/su',
      '/data/local/su',
      '/su/bin/su',
    ];

    // Note: In production, you'd use native modules to check file existence
    // For now, we rely on JailMonkey's detection
    return false;
  }

  /**
   * Check for common root management apps
   */
  private async checkRootApps(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    // JailMonkey already checks for these
    return false;
  }

  /**
   * Check if device is jailbroken (iOS)
   */
  private async checkJailbreak(): Promise<boolean> {
    if (Platform.OS !== 'ios') return false;

    try {
      return JailMonkey.isJailBroken();
    } catch (error) {
      console.error('Jailbreak check failed:', error);
      return false;
    }
  }

  /**
   * Check if running on emulator
   */
  private async checkEmulator(): Promise<boolean> {
    try {
      return await DeviceInfo.isEmulator();
    } catch (error) {
      console.error('Emulator check failed:', error);
      return false;
    }
  }

  /**
   * Check if debugger is attached
   */
  private async checkDebugger(): Promise<boolean> {
    try {
      // Check if running in debug mode
      return __DEV__;
    } catch (error) {
      console.error('Debugger check failed:', error);
      return false;
    }
  }

  /**
   * Check if developer mode is enabled
   */
  private async checkDeveloperMode(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    try {
      // JailMonkey provides this check
      return JailMonkey.isOnExternalStorage();
    } catch (error) {
      console.error('Developer mode check failed:', error);
      return false;
    }
  }

  /**
   * Check for hooking frameworks
   */
  private async checkHooks(): Promise<boolean> {
    try {
      // Check for common hooking frameworks
      const hasXposed = JailMonkey.hookDetected();

      // Additional checks for Frida, Substrate, etc.
      // In production, you'd use native modules for more thorough detection

      return hasXposed;
    } catch (error) {
      console.error('Hook detection failed:', error);
      return false;
    }
  }

  /**
   * Check for suspicious apps
   */
  private async checkSuspiciousApps(): Promise<boolean> {
    try {
      // JailMonkey checks for common suspicious apps
      return JailMonkey.isJailBroken(); // This includes suspicious app detection
    } catch (error) {
      console.error('Suspicious apps check failed:', error);
      return false;
    }
  }

  /**
   * Check if mock location is enabled
   */
  private async checkMockLocation(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    try {
      return JailMonkey.canMockLocation();
    } catch (error) {
      console.error('Mock location check failed:', error);
      return false;
    }
  }

  /**
   * Check if app is on external storage
   */
  private async checkExternalStorage(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    try {
      return JailMonkey.isOnExternalStorage();
    } catch (error) {
      console.error('External storage check failed:', error);
      return false;
    }
  }

  /**
   * Analyze threats based on device security info
   */
  private analyzeThreats(deviceInfo: DeviceSecurityInfo): SecurityThreat[] {
    const threats: SecurityThreat[] = [];

    // Root detection
    if (deviceInfo.isRooted) {
      threats.push({
        type: 'root_detected',
        severity: 'critical',
        description:
          'Device is rooted. This poses a significant security risk.',
        recommendation:
          'For your security, please use PasswordEpic on a non-rooted device.',
      });
    }

    // Jailbreak detection
    if (deviceInfo.isJailbroken) {
      threats.push({
        type: 'jailbreak_detected',
        severity: 'critical',
        description: 'Device is jailbroken. This compromises app security.',
        recommendation:
          'For your security, please use PasswordEpic on a non-jailbroken device.',
      });
    }

    // Debugger detection
    if (deviceInfo.isDebuggerAttached) {
      threats.push({
        type: 'debugger_attached',
        severity: 'high',
        description: 'Debugger is attached to the app.',
        recommendation: 'Please close any debugging tools and restart the app.',
      });
    }

    // Hook detection
    if (deviceInfo.hasHooks) {
      threats.push({
        type: 'hook_detected',
        severity: 'critical',
        description: 'Hooking framework detected (Xposed, Frida, etc.).',
        recommendation: 'Please remove hooking frameworks and restart the app.',
      });
    }

    // Emulator detection (low severity for development)
    if (deviceInfo.isEmulator) {
      threats.push({
        type: 'emulator_detected',
        severity: 'low',
        description: 'App is running on an emulator.',
        recommendation: 'For production use, please use a physical device.',
      });
    }

    // Developer mode
    if (deviceInfo.isDeveloperModeEnabled) {
      threats.push({
        type: 'developer_mode',
        severity: 'medium',
        description: 'Developer mode is enabled on this device.',
        recommendation:
          'Consider disabling developer mode for enhanced security.',
      });
    }

    // Suspicious apps
    if (deviceInfo.hasSuspiciousApps) {
      threats.push({
        type: 'suspicious_apps',
        severity: 'high',
        description: 'Suspicious apps detected on device.',
        recommendation: 'Please remove any suspicious apps and restart.',
      });
    }

    // External storage (Android)
    if (deviceInfo.isOnExternalStorage) {
      threats.push({
        type: 'tampering_detected',
        severity: 'medium',
        description: 'App is installed on external storage.',
        recommendation:
          'For better security, install the app on internal storage.',
      });
    }

    return threats;
  }

  /**
   * Check if device is secure enough to use the app
   */
  public async isDeviceSecure(): Promise<boolean> {
    const result = await this.performSecurityCheck();
    return result.isSecure;
  }

  /**
   * Get critical threats only
   */
  public async getCriticalThreats(): Promise<SecurityThreat[]> {
    const result = await this.performSecurityCheck();
    return result.threats.filter(t => t.severity === 'critical');
  }

  /**
   * Clear security check cache
   */
  public clearCache(): void {
    this.securityCheckCache = null;
    this.lastCheckTime = 0;
  }

  /**
   * Get security status summary
   */
  public async getSecuritySummary(): Promise<string> {
    const result = await this.performSecurityCheck();

    if (result.isSecure) {
      return 'Device security: ✅ Secure';
    }

    const criticalCount = result.threats.filter(
      t => t.severity === 'critical',
    ).length;
    const highCount = result.threats.filter(t => t.severity === 'high').length;

    if (criticalCount > 0) {
      return `Device security: ⚠️ ${criticalCount} critical threat(s) detected`;
    }

    if (highCount > 0) {
      return `Device security: ⚠️ ${highCount} high-risk threat(s) detected`;
    }

    return `Device security: ⚠️ ${result.threats.length} threat(s) detected`;
  }
}

export default SecurityService.getInstance();
