import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuditHistoryEntry } from '../types/password';

const AUDIT_HISTORY_PREFIX = 'passwordepic_audit_history_';
const MAX_HISTORY_PER_ENTRY = 30;

export class AuditHistoryService {
  /**
   * Save audit result to history
   */
  public static async saveAuditResult(
    passwordEntryId: string,
    auditEntry: Omit<AuditHistoryEntry, 'id'>,
  ): Promise<AuditHistoryEntry> {
    try {
      const key = this.getStorageKey(passwordEntryId);
      const history = await this.getAuditHistory(passwordEntryId);

      const newEntry: AuditHistoryEntry = {
        ...auditEntry,
        id: `audit_${Date.now()}`,
      };

      const updatedHistory = [newEntry, ...history].slice(0, MAX_HISTORY_PER_ENTRY);

      await AsyncStorage.setItem(key, JSON.stringify(updatedHistory));
      console.log(
        `✅ [AuditHistoryService] Saved audit result for entry: ${passwordEntryId}`,
      );

      return newEntry;
    } catch (error) {
      console.error('[AuditHistoryService] Error saving audit result:', error);
      throw error;
    }
  }

  /**
   * Get all audit history for a password entry
   */
  public static async getAuditHistory(
    passwordEntryId: string,
  ): Promise<AuditHistoryEntry[]> {
    try {
      const key = this.getStorageKey(passwordEntryId);
      const data = await AsyncStorage.getItem(key);

      if (!data) {
        return [];
      }

      const history = JSON.parse(data) as AuditHistoryEntry[];
      // Convert date strings back to Date objects
      return history.map(entry => ({
        ...entry,
        date: new Date(entry.date),
        passwordStrength: {
          ...entry.passwordStrength,
        },
      }));
    } catch (error) {
      console.error('[AuditHistoryService] Error retrieving audit history:', error);
      return [];
    }
  }

  /**
   * Get latest audit result
   */
  public static async getLatestAudit(
    passwordEntryId: string,
  ): Promise<AuditHistoryEntry | null> {
    try {
      const history = await this.getAuditHistory(passwordEntryId);
      return history.length > 0 ? history[0] : null;
    } catch (error) {
      console.error('[AuditHistoryService] Error getting latest audit:', error);
      return null;
    }
  }

  /**
   * Get audit statistics over time
   */
  public static async getAuditStatistics(
    passwordEntryId: string,
  ): Promise<{
    averageScore: number;
    highestScore: number;
    lowestScore: number;
    trend: 'improving' | 'declining' | 'stable';
    totalAudits: number;
  }> {
    try {
      const history = await this.getAuditHistory(passwordEntryId);

      if (history.length === 0) {
        return {
          averageScore: 0,
          highestScore: 0,
          lowestScore: 0,
          trend: 'stable',
          totalAudits: 0,
        };
      }

      const scores = history.map(h => h.score);
      const averageScore = Math.round(
        scores.reduce((a, b) => a + b, 0) / scores.length,
      );
      const highestScore = Math.max(...scores);
      const lowestScore = Math.min(...scores);

      let trend: 'improving' | 'declining' | 'stable' = 'stable';
      if (history.length >= 2) {
        const recentScore = history[0].score;
        const previousScore = history[1].score;
        if (recentScore > previousScore + 5) {
          trend = 'improving';
        } else if (recentScore < previousScore - 5) {
          trend = 'declining';
        }
      }

      return {
        averageScore,
        highestScore,
        lowestScore,
        trend,
        totalAudits: history.length,
      };
    } catch (error) {
      console.error('[AuditHistoryService] Error getting audit statistics:', error);
      return {
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        trend: 'stable',
        totalAudits: 0,
      };
    }
  }

  /**
   * Clear audit history for a password entry
   */
  public static async clearAuditHistory(passwordEntryId: string): Promise<void> {
    try {
      const key = this.getStorageKey(passwordEntryId);
      await AsyncStorage.removeItem(key);
      console.log(
        `✅ [AuditHistoryService] Cleared audit history for entry: ${passwordEntryId}`,
      );
    } catch (error) {
      console.error('[AuditHistoryService] Error clearing audit history:', error);
      throw error;
    }
  }

  /**
   * Delete specific audit entry
   */
  public static async deleteAuditEntry(
    passwordEntryId: string,
    auditId: string,
  ): Promise<void> {
    try {
      const history = await this.getAuditHistory(passwordEntryId);
      const updated = history.filter(h => h.id !== auditId);
      const key = this.getStorageKey(passwordEntryId);
      await AsyncStorage.setItem(key, JSON.stringify(updated));
    } catch (error) {
      console.error('[AuditHistoryService] Error deleting audit entry:', error);
      throw error;
    }
  }

  /**
   * Get audit history for date range
   */
  public static async getAuditsByDateRange(
    passwordEntryId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<AuditHistoryEntry[]> {
    try {
      const history = await this.getAuditHistory(passwordEntryId);
      return history.filter(
        entry =>
          entry.date >= startDate &&
          entry.date <= endDate,
      );
    } catch (error) {
      console.error('[AuditHistoryService] Error getting audits by date range:', error);
      return [];
    }
  }

  /**
   * Compare two audit entries to detect changes
   */
  public static compareAudits(
    current: AuditHistoryEntry,
    previous?: AuditHistoryEntry,
  ): string[] {
    const changes: string[] = [];

    if (!previous) {
      changes.push(`First audit - Score: ${current.score}/100`);
      return changes;
    }

    if (current.score > previous.score) {
      changes.push(
        `✅ Score improved: ${previous.score} → ${current.score} (+${current.score - previous.score})`,
      );
    } else if (current.score < previous.score) {
      changes.push(
        `⚠️ Score declined: ${previous.score} → ${current.score} (${current.score - previous.score})`,
      );
    }

    if (current.vulnerabilityCount > previous.vulnerabilityCount) {
      changes.push(
        `New vulnerabilities found: +${current.vulnerabilityCount - previous.vulnerabilityCount}`,
      );
    } else if (current.vulnerabilityCount < previous.vulnerabilityCount) {
      changes.push(
        `Vulnerabilities resolved: -${previous.vulnerabilityCount - current.vulnerabilityCount}`,
      );
    }

    if (current.riskLevel !== previous.riskLevel) {
      changes.push(`Risk level changed: ${previous.riskLevel} → ${current.riskLevel}`);
    }

    return changes;
  }

  /**
   * Generate audit history summary
   */
  public static async generateSummary(
    passwordEntryId: string,
  ): Promise<string> {
    try {
      const history = await this.getAuditHistory(passwordEntryId);
      const stats = await this.getAuditStatistics(passwordEntryId);

      if (history.length === 0) {
        return 'No audit history available';
      }

      const latest = history[0];
      const oldest = history[history.length - 1];
      const daysSpan = Math.floor(
        (latest.date.getTime() - oldest.date.getTime()) / (1000 * 60 * 60 * 24),
      );

      let summary = `Audit History (${history.length} audits over ${daysSpan} days)\n`;
      summary += `Average Score: ${stats.averageScore}/100 • Trend: ${stats.trend}\n`;
      summary += `Latest: ${latest.score}/100 (${latest.riskLevel})`;

      return summary;
    } catch (error) {
      console.error('[AuditHistoryService] Error generating summary:', error);
      return 'Error generating summary';
    }
  }

  private static getStorageKey(passwordEntryId: string): string {
    return `${AUDIT_HISTORY_PREFIX}${passwordEntryId}`;
  }
}
