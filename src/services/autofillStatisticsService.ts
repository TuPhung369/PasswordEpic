/**
 * Autofill Statistics Service
 *
 * Comprehensive statistics tracking for autofill usage, security, and service health.
 * Tracks events, generates reports, and provides historical data.
 *
 * @author PasswordEpic Team
 * @since Week 9+
 */

import { secureStorageService } from './secureStorageService';

/**
 * Individual autofill event record
 */
export interface AutofillEventRecord {
  eventType: 'fill' | 'save' | 'blocked' | 'verification' | 'biometric';
  domain: string;
  timestamp: number;
  success: boolean;
  errorMessage?: string;
  autoVerified?: boolean; // true if auto-verified, false if manual
}

/**
 * Top domain statistic
 */
export interface TopDomain {
  domain: string;
  fillCount: number;
  saveCount: number;
  lastUsed: number;
  autoVerified: boolean;
}

/**
 * Recently added domain
 */
export interface RecentlyAddedDomain {
  domain: string;
  addedAt: number;
  autoVerified: boolean;
}

/**
 * Comprehensive autofill statistics
 */
export interface ComprehensiveAutofillStats {
  // Core metrics
  totalFills: number;
  totalSaves: number;
  thisWeekFills: number;
  thisMonthFills: number;
  lastUsedTimestamp: number | null;
  lastUsedDomain: string | null;

  // Domain performance
  mostUsedDomains: TopDomain[];
  totalTrustedDomains: number;
  recentlyAddedDomains: RecentlyAddedDomain[];
  autoVerifiedDomainCount: number;

  // Security metrics
  blockedPhishing: number;
  verificationSuccessRate: number; // percentage (0-100)
  biometricAuthCount: number;

  // Service health
  serviceEnabled: boolean;
  lastSyncTimestamp: number | null;
  autoSubmitRate: number; // percentage (0-100)
  subdomainMatchingUsageCount: number;
}

const STORAGE_KEY = 'autofill_statistics';
const MAX_EVENTS_STORED = 1000;
const STATS_RETENTION_DAYS = 90;

class AutofillStatisticsService {
  private eventCache: AutofillEventRecord[] = [];
  private initialized = false;

  /**
   * Initialize the statistics service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const stored = await secureStorageService.getItem(STORAGE_KEY);
      if (stored) {
        this.eventCache = JSON.parse(stored);
        console.log(
          `✅ [AutofillStats] Loaded ${this.eventCache.length} events from storage`,
        );
      } else {
        this.eventCache = [];
        console.log('ℹ️ [AutofillStats] No previous statistics found');
      }

      // Clean old events (older than retention period)
      this.cleanOldEvents();
      this.initialized = true;
    } catch (error) {
      console.error('❌ [AutofillStats] Failed to initialize:', error);
      this.eventCache = [];
      this.initialized = true;
    }
  }

  /**
   * Record an autofill event
   */
  async recordEvent(event: AutofillEventRecord): Promise<void> {
    try {
      await this.ensureInitialized();
      this.eventCache.push(event);

      // Keep cache size under control
      if (this.eventCache.length > MAX_EVENTS_STORED) {
        this.eventCache = this.eventCache.slice(-MAX_EVENTS_STORED);
      }

      // Persist to storage
      await secureStorageService.setItem(
        STORAGE_KEY,
        JSON.stringify(this.eventCache),
      );

      console.log(
        `📊 [AutofillStats] Recorded ${event.eventType} event for ${event.domain}`,
      );
    } catch (error) {
      console.error('❌ [AutofillStats] Failed to record event:', error);
    }
  }

  /**
   * Record an autofill fill event
   */
  async recordFill(
    domain: string,
    success: boolean = true,
    error?: string,
  ): Promise<void> {
    await this.recordEvent({
      eventType: 'fill',
      domain,
      timestamp: Date.now(),
      success,
      errorMessage: error,
    });
  }

  /**
   * Record an autofill save event
   */
  async recordSave(
    domain: string,
    success: boolean = true,
    error?: string,
  ): Promise<void> {
    await this.recordEvent({
      eventType: 'save',
      domain,
      timestamp: Date.now(),
      success,
      errorMessage: error,
    });
  }

  /**
   * Record a blocked phishing attempt
   */
  async recordBlockedPhishing(domain: string, reason: string): Promise<void> {
    await this.recordEvent({
      eventType: 'blocked',
      domain,
      timestamp: Date.now(),
      success: true,
      errorMessage: reason,
    });
  }

  /**
   * Record a verification event
   */
  async recordVerification(
    domain: string,
    success: boolean,
    autoVerified: boolean = false,
    error?: string,
  ): Promise<void> {
    await this.recordEvent({
      eventType: 'verification',
      domain,
      timestamp: Date.now(),
      success,
      autoVerified,
      errorMessage: error,
    });
  }

  /**
   * Record a biometric authentication
   */
  async recordBiometricAuth(success: boolean, error?: string): Promise<void> {
    await this.recordEvent({
      eventType: 'biometric',
      domain: 'system',
      timestamp: Date.now(),
      success,
      errorMessage: error,
    });
  }

  /**
   * Get comprehensive statistics
   */
  async getComprehensiveStats(
    trustedDomainsCount: number = 0,
  ): Promise<ComprehensiveAutofillStats> {
    try {
      await this.ensureInitialized();

      const now = Date.now();
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
      const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

      // Calculate basic metrics
      const totalFills = this.eventCache.filter(
        e => e.eventType === 'fill' && e.success,
      ).length;
      const totalSaves = this.eventCache.filter(
        e => e.eventType === 'save' && e.success,
      ).length;
      const blockedPhishing = this.eventCache.filter(
        e => e.eventType === 'blocked' && e.success,
      ).length;
      const biometricAuthCount = this.eventCache.filter(
        e => e.eventType === 'biometric' && e.success,
      ).length;

      // Time-based metrics
      const thisWeekFills = this.eventCache.filter(
        e => e.eventType === 'fill' && e.success && e.timestamp >= weekAgo,
      ).length;
      const thisMonthFills = this.eventCache.filter(
        e => e.eventType === 'fill' && e.success && e.timestamp >= monthAgo,
      ).length;

      // Last used
      const lastFillEvent = this.eventCache
        .filter(e => e.eventType === 'fill' && e.success)
        .sort((a, b) => b.timestamp - a.timestamp)[0];

      // Domain performance
      const domainStats = this.calculateDomainStats();
      const mostUsedDomains = domainStats.slice(0, 5);

      // Recently added domains (last 7 days)
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      const recentlyAddedDomains = this.getRecentlyAddedDomains().filter(
        d => d.addedAt >= sevenDaysAgo,
      );

      // Auto-verified domains count
      const autoVerifiedCount = this.eventCache.filter(
        e => e.eventType === 'verification' && e.success && e.autoVerified,
      ).length;

      // Verification success rate
      const verificationEvents = this.eventCache.filter(
        e => e.eventType === 'verification',
      );
      const verificationSuccessRate =
        verificationEvents.length > 0
          ? (verificationEvents.filter(e => e.success).length /
              verificationEvents.length) *
            100
          : 0;

      // Auto-submit rate (approximation: successful fills with short time gaps)
      const autoSubmitRate = this.estimateAutoSubmitRate();

      // Subdomain matching usage count
      const subdomainMatchingCount = this.eventCache.filter(
        e => e.domain && e.domain.includes('.') && e.eventType === 'fill',
      ).length;

      return {
        // Core metrics
        totalFills,
        totalSaves,
        thisWeekFills,
        thisMonthFills,
        lastUsedTimestamp: lastFillEvent?.timestamp ?? null,
        lastUsedDomain: lastFillEvent?.domain ?? null,

        // Domain performance
        mostUsedDomains,
        totalTrustedDomains: trustedDomainsCount,
        recentlyAddedDomains,
        autoVerifiedDomainCount: autoVerifiedCount,

        // Security metrics
        blockedPhishing,
        verificationSuccessRate: Math.round(verificationSuccessRate),
        biometricAuthCount,

        // Service health
        serviceEnabled: true, // Would be fetched from settings
        lastSyncTimestamp: this.getLastSyncTimestamp(),
        autoSubmitRate: Math.round(autoSubmitRate),
        subdomainMatchingUsageCount: subdomainMatchingCount,
      };
    } catch (error) {
      console.error('❌ [AutofillStats] Failed to get stats:', error);
      return this.getEmptyStats();
    }
  }

  /**
   * Calculate statistics for each domain
   */
  private calculateDomainStats(): TopDomain[] {
    const domainMap = new Map<string, TopDomain>();

    this.eventCache.forEach(event => {
      if (!event.domain || event.domain === 'system') return;

      if (!domainMap.has(event.domain)) {
        domainMap.set(event.domain, {
          domain: event.domain,
          fillCount: 0,
          saveCount: 0,
          lastUsed: 0,
          autoVerified: event.autoVerified ?? false,
        });
      }

      const stat = domainMap.get(event.domain)!;
      if (event.eventType === 'fill' && event.success) {
        stat.fillCount++;
      } else if (event.eventType === 'save' && event.success) {
        stat.saveCount++;
      }

      if (event.timestamp > stat.lastUsed) {
        stat.lastUsed = event.timestamp;
      }
    });

    return Array.from(domainMap.values()).sort(
      (a, b) => b.fillCount - a.fillCount,
    );
  }

  /**
   * Get recently added domains from verification events
   */
  private getRecentlyAddedDomains(): RecentlyAddedDomain[] {
    const domains = new Map<string, RecentlyAddedDomain>();

    this.eventCache
      .filter(e => e.eventType === 'verification')
      .sort((a, b) => a.timestamp - b.timestamp)
      .forEach(event => {
        if (!event.domain || event.domain === 'system') return;

        if (!domains.has(event.domain)) {
          domains.set(event.domain, {
            domain: event.domain,
            addedAt: event.timestamp,
            autoVerified: event.autoVerified ?? false,
          });
        }
      });

    return Array.from(domains.values()).sort((a, b) => b.addedAt - a.addedAt);
  }

  /**
   * Estimate auto-submit rate (heuristic based on rapid consecutive fills)
   */
  private estimateAutoSubmitRate(): number {
    if (this.eventCache.length < 2) return 0;

    const fillEvents = this.eventCache
      .filter(e => e.eventType === 'fill' && e.success)
      .sort((a, b) => a.timestamp - b.timestamp);

    let autoSubmitCount = 0;
    const timeThreshold = 5000; // 5 seconds

    for (let i = 1; i < fillEvents.length; i++) {
      const timeDiff = fillEvents[i].timestamp - fillEvents[i - 1].timestamp;
      if (
        timeDiff < timeThreshold &&
        fillEvents[i].domain === fillEvents[i - 1].domain
      ) {
        autoSubmitCount++;
      }
    }

    return fillEvents.length > 0
      ? (autoSubmitCount / fillEvents.length) * 100
      : 0;
  }

  /**
   * Get last sync timestamp (from storage)
   */
  private getLastSyncTimestamp(): number | null {
    // In a real implementation, this would track actual sync events
    // For now, return the most recent event timestamp
    if (this.eventCache.length === 0) return null;

    const lastEvent = this.eventCache.reduce((latest, current) =>
      current.timestamp > latest.timestamp ? current : latest,
    );

    return lastEvent.timestamp;
  }

  /**
   * Estimate auto-submit usage (where multiple fills happen rapidly)
   */
  private estimateSubdomainMatching(): number {
    return this.eventCache.filter(
      e =>
        e.eventType === 'fill' &&
        e.success &&
        e.domain &&
        (e.domain.match(/\./g) || []).length >= 2,
    ).length;
  }

  /**
   * Clean events older than retention period
   */
  private cleanOldEvents(): void {
    const cutoffTime = Date.now() - STATS_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const originalLength = this.eventCache.length;

    this.eventCache = this.eventCache.filter(e => e.timestamp >= cutoffTime);

    if (this.eventCache.length < originalLength) {
      console.log(
        `🧹 [AutofillStats] Cleaned ${
          originalLength - this.eventCache.length
        } old events`,
      );
    }
  }

  /**
   * Clear all statistics (for testing or user request)
   */
  async clearAllStatistics(): Promise<void> {
    try {
      this.eventCache = [];
      await secureStorageService.removeItem(STORAGE_KEY);
      console.log('🗑️ [AutofillStats] All statistics cleared');
    } catch (error) {
      console.error('❌ [AutofillStats] Failed to clear statistics:', error);
    }
  }

  /**
   * Export statistics as JSON
   */
  async exportStatistics(): Promise<string> {
    try {
      await this.ensureInitialized();
      return JSON.stringify({
        exportedAt: new Date().toISOString(),
        totalEvents: this.eventCache.length,
        events: this.eventCache,
      });
    } catch (error) {
      console.error('❌ [AutofillStats] Failed to export statistics:', error);
      throw error;
    }
  }

  /**
   * Get empty stats structure
   */
  private getEmptyStats(): ComprehensiveAutofillStats {
    return {
      totalFills: 0,
      totalSaves: 0,
      thisWeekFills: 0,
      thisMonthFills: 0,
      lastUsedTimestamp: null,
      lastUsedDomain: null,
      mostUsedDomains: [],
      totalTrustedDomains: 0,
      recentlyAddedDomains: [],
      autoVerifiedDomainCount: 0,
      blockedPhishing: 0,
      verificationSuccessRate: 0,
      biometricAuthCount: 0,
      serviceEnabled: false,
      lastSyncTimestamp: null,
      autoSubmitRate: 0,
      subdomainMatchingUsageCount: 0,
    };
  }

  /**
   * Ensure service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

export const autofillStatisticsService = new AutofillStatisticsService();
