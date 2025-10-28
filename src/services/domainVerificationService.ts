/**
 * Domain Verification Service
 *
 * Manages domain verification and trusted domain whitelist.
 * Provides domain matching logic for autofill operations.
 *
 * Features:
 * - Domain whitelist management
 * - Trusted domain storage
 * - Domain matching algorithms
 * - User confirmation for new domains
 * - Phishing detection integration
 */

import { secureStorageService } from './secureStorageService';

/**
 * Domain verification result
 */
export interface DomainVerificationResult {
  isValid: boolean;
  isTrusted: boolean;
  requiresConfirmation: boolean;
  reason?: string;
}

/**
 * Trusted domain entry
 */
export interface TrustedDomain {
  domain: string;
  addedAt: number;
  lastUsed: number;
  useCount: number;
  autoApproved: boolean;
}

class DomainVerificationService {
  private trustedDomainsCache: Map<string, TrustedDomain> | null = null;

  /**
   * Verifies a domain for autofill
   *
   * @param domain The domain to verify
   * @param packageName The package name (for Android apps)
   */
  async verifyDomain(
    domain: string,
    packageName?: string,
  ): Promise<DomainVerificationResult> {
    try {
      // Normalize domain
      const normalizedDomain = this.normalizeDomain(domain);

      // Check if domain is valid
      if (!this.isValidDomain(normalizedDomain)) {
        return {
          isValid: false,
          isTrusted: false,
          requiresConfirmation: false,
          reason: 'Invalid domain format',
        };
      }

      // Check if domain is trusted
      const isTrusted = await this.isTrustedDomain(normalizedDomain);

      // Check if domain requires confirmation
      const requiresConfirmation =
        !isTrusted && !this.isWellKnownDomain(normalizedDomain);

      return {
        isValid: true,
        isTrusted,
        requiresConfirmation,
      };
    } catch (error) {
      console.error('Error verifying domain:', error);
      return {
        isValid: false,
        isTrusted: false,
        requiresConfirmation: false,
        reason: 'Verification error',
      };
    }
  }

  /**
   * Adds a domain to the trusted list
   *
   * @param domain The domain to trust
   * @param autoApproved Whether it was auto-approved
   * @returns Whether the domain was successfully added
   */
  async addTrustedDomain(
    domain: string,
    autoApproved: boolean = false,
  ): Promise<boolean> {
    try {
      const normalizedDomain = this.normalizeDomain(domain);
      const trustedDomains = await this.getTrustedDomains();

      // Check if already exists
      const existing = trustedDomains.find(d => d.domain === normalizedDomain);
      if (existing) {
        // Update last used
        existing.lastUsed = Date.now();
        existing.useCount++;
      } else {
        // Add new trusted domain
        trustedDomains.push({
          domain: normalizedDomain,
          addedAt: Date.now(),
          lastUsed: Date.now(),
          useCount: 1,
          autoApproved,
        });
      }

      await this.saveTrustedDomains(trustedDomains);
      this.trustedDomainsCache = null; // Clear cache

      console.log(`Added trusted domain: ${normalizedDomain}`);
      return true;
    } catch (error) {
      console.error('Error adding trusted domain:', error);
      throw error;
    }
  }

  /**
   * Removes a domain from the trusted list
   *
   * @param domain The domain to remove
   * @returns Whether the domain was successfully removed
   */
  async removeTrustedDomain(domain: string): Promise<boolean> {
    try {
      const normalizedDomain = this.normalizeDomain(domain);
      const trustedDomains = await this.getTrustedDomains();

      const filtered = trustedDomains.filter(
        d => d.domain !== normalizedDomain,
      );
      await this.saveTrustedDomains(filtered);
      this.trustedDomainsCache = null; // Clear cache

      console.log(`Removed trusted domain: ${normalizedDomain}`);
      return true;
    } catch (error) {
      console.error('Error removing trusted domain:', error);
      throw error;
    }
  }

  /**
   * Gets all trusted domains
   */
  async getTrustedDomains(): Promise<TrustedDomain[]> {
    try {
      const domainsJson = await secureStorageService.getItem('trusted_domains');
      if (!domainsJson) {
        return [];
      }

      return JSON.parse(domainsJson);
    } catch (error) {
      console.error('Error getting trusted domains:', error);
      return [];
    }
  }

  /**
   * Saves trusted domains
   * Public method to support backup/restore functionality
   */
  async saveTrustedDomains(domains: TrustedDomain[]): Promise<void> {
    await secureStorageService.setItem(
      'trusted_domains',
      JSON.stringify(domains),
    );
  }

  /**
   * Checks if a domain is trusted
   *
   * @param domain The domain to check
   */
  async isTrustedDomain(domain: string): Promise<boolean> {
    try {
      const normalizedDomain = this.normalizeDomain(domain);
      const trustedDomains = await this.getTrustedDomains();

      return trustedDomains.some(d =>
        this.domainsMatch(d.domain, normalizedDomain),
      );
    } catch (error) {
      console.error('Error checking trusted domain:', error);
      return false;
    }
  }

  /**
   * Checks if a domain is well-known (auto-trusted)
   *
   * @param domain The domain to check
   */
  private isWellKnownDomain(domain: string): boolean {
    const wellKnownDomains = [
      'google.com',
      'facebook.com',
      'twitter.com',
      'github.com',
      'microsoft.com',
      'apple.com',
      'amazon.com',
      'netflix.com',
      'linkedin.com',
      'instagram.com',
      'youtube.com',
      'reddit.com',
    ];

    const normalizedDomain = this.normalizeDomain(domain);

    return wellKnownDomains.some(
      wellKnown =>
        normalizedDomain === wellKnown ||
        normalizedDomain.endsWith(`.${wellKnown}`),
    );
  }

  /**
   * Normalizes a domain for comparison
   * Removes protocol, www, path, query, fragment, and port
   *
   * @param domain The domain to normalize
   */
  private normalizeDomain(domain: string): string {
    let normalized = domain.toLowerCase().trim();

    // Remove protocol (http://, https://, etc.)
    normalized = normalized.replace(/^[a-z]+:\/\//, '');

    // Remove www. prefix
    normalized = normalized.replace(/^www\./, '');

    // Remove everything after / (path)
    normalized = normalized.split('/')[0];

    // Remove everything after ? (query string)
    normalized = normalized.split('?')[0];

    // Remove everything after # (fragment)
    normalized = normalized.split('#')[0];

    // Remove port (:80, :443, etc.)
    normalized = normalized.split(':')[0];

    return normalized;
  }

  /**
   * Extracts clean domain from user input
   * Useful for UI feedback showing what will actually be saved
   *
   * @param input The user input (can include protocol, path, port, etc.)
   * @returns The clean domain that will be saved
   */
  public extractCleanDomain(input: string): string {
    return this.normalizeDomain(input);
  }

  /**
   * Validates domain format
   *
   * @param domain The domain to validate
   */
  private isValidDomain(domain: string): boolean {
    if (!domain || domain.length === 0) {
      return false;
    }

    // Basic domain regex
    const domainRegex =
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;

    return domainRegex.test(domain);
  }

  /**
   * Checks if two domains match
   *
   * @param domain1 First domain
   * @param domain2 Second domain
   * @param allowSubdomains Whether to allow subdomain matching
   */
  domainsMatch(
    domain1: string,
    domain2: string,
    allowSubdomains: boolean = true,
  ): boolean {
    const normalized1 = this.normalizeDomain(domain1);
    const normalized2 = this.normalizeDomain(domain2);

    if (normalized1 === normalized2) {
      return true;
    }

    if (!allowSubdomains) {
      return false;
    }

    // Check subdomain matching
    return (
      normalized1.endsWith(`.${normalized2}`) ||
      normalized2.endsWith(`.${normalized1}`)
    );
  }

  /**
   * Extracts root domain from full domain
   *
   * @param domain The full domain
   */
  extractRootDomain(domain: string): string {
    const normalized = this.normalizeDomain(domain);
    const parts = normalized.split('.');

    // Return last two parts (domain + TLD)
    if (parts.length >= 2) {
      return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    }

    return normalized;
  }

  /**
   * Gets domain statistics
   *
   * @param domain The domain to get stats for
   */
  async getDomainStats(domain: string): Promise<TrustedDomain | null> {
    try {
      const normalizedDomain = this.normalizeDomain(domain);
      const trustedDomains = await this.getTrustedDomains();

      return trustedDomains.find(d => d.domain === normalizedDomain) || null;
    } catch (error) {
      console.error('Error getting domain stats:', error);
      return null;
    }
  }

  /**
   * Clears all trusted domains
   */
  async clearTrustedDomains(): Promise<void> {
    try {
      await secureStorageService.removeItem('trusted_domains');
      this.trustedDomainsCache = null;
      console.log('Cleared all trusted domains');
    } catch (error) {
      console.error('Error clearing trusted domains:', error);
      throw error;
    }
  }

  /**
   * Exports trusted domains for backup
   */
  async exportTrustedDomains(): Promise<string> {
    try {
      const domains = await this.getTrustedDomains();
      return JSON.stringify(domains, null, 2);
    } catch (error) {
      console.error('Error exporting trusted domains:', error);
      throw error;
    }
  }

  /**
   * Imports trusted domains from backup
   *
   * @param data The JSON data to import
   */
  async importTrustedDomains(data: string): Promise<void> {
    try {
      const domains: TrustedDomain[] = JSON.parse(data);

      // Validate data
      if (!Array.isArray(domains)) {
        throw new Error('Invalid data format');
      }

      await this.saveTrustedDomains(domains);
      this.trustedDomainsCache = null;

      console.log(`Imported ${domains.length} trusted domains`);
    } catch (error) {
      console.error('Error importing trusted domains:', error);
      throw error;
    }
  }
}

export const domainVerificationService = new DomainVerificationService();
