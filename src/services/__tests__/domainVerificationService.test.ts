/**
 * Domain Verification Service Tests
 * Comprehensive test suite for domain verification and trusted domain management
 */

// Import the real service and mock its dependency
import { domainVerificationService } from '../domainVerificationService';
import * as secureStorageModule from '../secureStorageService';

// Mock the secure storage service methods
jest.mock('../secureStorageService');

describe('DomainVerificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('domainsMatch - Synchronous Public Method', () => {
    it('should match exact same domain', () => {
      const result = domainVerificationService.domainsMatch(
        'google.com',
        'google.com',
      );
      expect(result).toBe(true);
    });

    it('should match with different protocols', () => {
      const result = domainVerificationService.domainsMatch(
        'https://google.com',
        'http://google.com',
      );
      expect(result).toBe(true);
    });

    it('should match with www prefix', () => {
      const result = domainVerificationService.domainsMatch(
        'www.google.com',
        'google.com',
      );
      expect(result).toBe(true);
    });

    it('should match subdomains when allowed', () => {
      const result = domainVerificationService.domainsMatch(
        'mail.google.com',
        'google.com',
        true,
      );
      expect(result).toBe(true);
    });

    it('should not match subdomains when disabled', () => {
      const result = domainVerificationService.domainsMatch(
        'mail.google.com',
        'google.com',
        false,
      );
      expect(result).toBe(false);
    });

    it('should not match different domains', () => {
      const result = domainVerificationService.domainsMatch(
        'google.com',
        'github.com',
      );
      expect(result).toBe(false);
    });

    it('should be case insensitive', () => {
      const result = domainVerificationService.domainsMatch(
        'Google.COM',
        'google.com',
      );
      expect(result).toBe(true);
    });

    it('should match reverse subdomain relationship', () => {
      const result = domainVerificationService.domainsMatch(
        'google.com',
        'mail.google.com',
        true,
      );
      expect(result).toBe(true);
    });

    it('should handle complex subdomain chains', () => {
      const result = domainVerificationService.domainsMatch(
        'deep.nested.google.com',
        'google.com',
        true,
      );
      expect(result).toBe(true);
    });
  });

  describe('extractRootDomain - Synchronous Public Method', () => {
    it('should extract root domain', () => {
      const result =
        domainVerificationService.extractRootDomain('mail.google.com');
      expect(result).toBe('google.com');
    });

    it('should handle single level domain', () => {
      const result = domainVerificationService.extractRootDomain('localhost');
      expect(result).toBe('localhost');
    });

    it('should remove protocol', () => {
      const result = domainVerificationService.extractRootDomain(
        'https://mail.google.com',
      );
      expect(result).toBe('google.com');
    });

    it('should remove www prefix', () => {
      const result = domainVerificationService.extractRootDomain(
        'www.mail.google.com',
      );
      expect(result).toBe('google.com');
    });

    it('should handle multiple subdomain levels', () => {
      const result = domainVerificationService.extractRootDomain(
        'deep.nested.example.com',
      );
      expect(result).toBe('example.com');
    });

    it('should remove port', () => {
      const result =
        domainVerificationService.extractRootDomain('example.com:8080');
      expect(result).toBe('example.com');
    });

    it('should handle domain with path and query', () => {
      const result = domainVerificationService.extractRootDomain(
        'example.com:3000/path?query=value',
      );
      expect(result).toBe('example.com');
    });
  });

  describe('getTrustedDomains', () => {
    it('should return empty array if no trusted domains', async () => {
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockResolvedValue(null);

      const result = await domainVerificationService.getTrustedDomains();

      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return trusted domains', async () => {
      const timestamp = Date.now();
      const trustedDomains = [
        {
          domain: 'google.com',
          addedAt: timestamp,
          lastUsed: timestamp,
          useCount: 5,
          autoApproved: false,
        },
      ];
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockResolvedValue(JSON.stringify(trustedDomains));

      const result = await domainVerificationService.getTrustedDomains();

      expect(result.length).toBe(1);
      expect(result[0].domain).toBe('google.com');
    });

    it('should handle parsing errors', async () => {
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockResolvedValue('invalid json');

      const result = await domainVerificationService.getTrustedDomains();

      expect(result).toEqual([]);
    });

    it('should return multiple domains', async () => {
      const timestamp = Date.now();
      const trustedDomains = [
        {
          domain: 'google.com',
          addedAt: timestamp,
          lastUsed: timestamp,
          useCount: 3,
          autoApproved: false,
        },
        {
          domain: 'github.com',
          addedAt: timestamp,
          lastUsed: timestamp,
          useCount: 2,
          autoApproved: true,
        },
      ];
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockResolvedValue(JSON.stringify(trustedDomains));

      const result = await domainVerificationService.getTrustedDomains();

      expect(result.length).toBe(2);
      expect(result[1].domain).toBe('github.com');
    });
  });

  describe('addTrustedDomain', () => {
    it('should add new domain to trusted list', async () => {
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockResolvedValue(null);
      (
        secureStorageModule.secureStorageService.setItem as jest.Mock
      ).mockResolvedValue(undefined);

      await domainVerificationService.addTrustedDomain('example.com');

      expect(
        secureStorageModule.secureStorageService.setItem,
      ).toHaveBeenCalled();
    });

    it('should update existing trusted domain', async () => {
      const timestamp = Date.now();
      const existing = [
        {
          domain: 'example.com',
          addedAt: timestamp,
          lastUsed: timestamp,
          useCount: 1,
          autoApproved: false,
        },
      ];
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockResolvedValue(JSON.stringify(existing));

      await domainVerificationService.addTrustedDomain('example.com');

      expect(
        secureStorageModule.secureStorageService.setItem,
      ).toHaveBeenCalled();
    });

    it('should increment use count when updating', async () => {
      const timestamp = Date.now();
      const existing = [
        {
          domain: 'example.com',
          addedAt: timestamp,
          lastUsed: timestamp,
          useCount: 5,
          autoApproved: false,
        },
      ];
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockResolvedValue(JSON.stringify(existing));

      await domainVerificationService.addTrustedDomain('example.com');

      const setItemCall = (
        secureStorageModule.secureStorageService.setItem as jest.Mock
      ).mock.calls[0];
      const savedData = JSON.parse(setItemCall[1]);
      expect(savedData[0].useCount).toBe(6);
    });

    it('should set autoApproved flag', async () => {
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockResolvedValue(null);

      await domainVerificationService.addTrustedDomain('example.com', true);

      const setItemCall = (
        secureStorageModule.secureStorageService.setItem as jest.Mock
      ).mock.calls[0];
      const savedData = JSON.parse(setItemCall[1]);
      expect(savedData[0].autoApproved).toBe(true);
    });

    it('should normalize domain before adding', async () => {
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockResolvedValue(null);

      await domainVerificationService.addTrustedDomain(
        'EXAMPLE.COM/path?query=1',
      );

      const setItemCall = (
        secureStorageModule.secureStorageService.setItem as jest.Mock
      ).mock.calls[0];
      const savedData = JSON.parse(setItemCall[1]);
      expect(savedData[0].domain).toBe('example.com');
    });
  });

  describe('removeTrustedDomain', () => {
    it('should remove domain from trusted list', async () => {
      const timestamp = Date.now();
      const existing = [
        {
          domain: 'example.com',
          addedAt: timestamp,
          lastUsed: timestamp,
          useCount: 1,
          autoApproved: false,
        },
      ];
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockResolvedValue(JSON.stringify(existing));

      await domainVerificationService.removeTrustedDomain('example.com');

      const setItemCall = (
        secureStorageModule.secureStorageService.setItem as jest.Mock
      ).mock.calls[0];
      const savedData = JSON.parse(setItemCall[1]);
      expect(savedData.length).toBe(0);
    });

    it('should handle removing non-existent domain', async () => {
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockResolvedValue(null);

      const result = await domainVerificationService.removeTrustedDomain(
        'example.com',
      );

      expect(result).toBe(true);
    });

    it('should normalize domain before removal', async () => {
      const timestamp = Date.now();
      const existing = [
        {
          domain: 'example.com',
          addedAt: timestamp,
          lastUsed: timestamp,
          useCount: 1,
          autoApproved: false,
        },
      ];
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockResolvedValue(JSON.stringify(existing));

      await domainVerificationService.removeTrustedDomain('EXAMPLE.COM/path');

      const setItemCall = (
        secureStorageModule.secureStorageService.setItem as jest.Mock
      ).mock.calls[0];
      const savedData = JSON.parse(setItemCall[1]);
      expect(savedData.length).toBe(0);
    });
  });

  describe('isTrustedDomain', () => {
    it('should return true for trusted domain', async () => {
      const timestamp = Date.now();
      const trustedDomains = [
        {
          domain: 'google.com',
          addedAt: timestamp,
          lastUsed: timestamp,
          useCount: 1,
          autoApproved: false,
        },
      ];
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockResolvedValue(JSON.stringify(trustedDomains));

      const result = await domainVerificationService.isTrustedDomain(
        'google.com',
      );

      expect(result).toBe(true);
    });

    it('should return false for untrusted domain', async () => {
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockResolvedValue(null);

      const result = await domainVerificationService.isTrustedDomain(
        'example.com',
      );

      expect(result).toBe(false);
    });

    it('should match subdomains', async () => {
      const timestamp = Date.now();
      const trustedDomains = [
        {
          domain: 'google.com',
          addedAt: timestamp,
          lastUsed: timestamp,
          useCount: 1,
          autoApproved: false,
        },
      ];
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockResolvedValue(JSON.stringify(trustedDomains));

      const result = await domainVerificationService.isTrustedDomain(
        'mail.google.com',
      );

      expect(result).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockRejectedValue(new Error('Storage error'));

      const result = await domainVerificationService.isTrustedDomain(
        'google.com',
      );

      expect(result).toBe(false);
    });

    it('should normalize domain for comparison', async () => {
      const timestamp = Date.now();
      const trustedDomains = [
        {
          domain: 'google.com',
          addedAt: timestamp,
          lastUsed: timestamp,
          useCount: 1,
          autoApproved: false,
        },
      ];
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockResolvedValue(JSON.stringify(trustedDomains));

      const result = await domainVerificationService.isTrustedDomain(
        'HTTPS://WWW.GOOGLE.COM/path',
      );

      expect(result).toBe(true);
    });
  });

  describe('getDomainStats', () => {
    it('should return domain statistics', async () => {
      const timestamp = Date.now();
      const trustedDomains = [
        {
          domain: 'google.com',
          addedAt: timestamp,
          lastUsed: timestamp,
          useCount: 5,
          autoApproved: false,
        },
      ];
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockResolvedValue(JSON.stringify(trustedDomains));

      const result = await domainVerificationService.getDomainStats(
        'google.com',
      );

      expect(result).not.toBeNull();
      expect(result?.useCount).toBe(5);
    });

    it('should return null for non-existent domain', async () => {
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockResolvedValue(null);

      const result = await domainVerificationService.getDomainStats(
        'example.com',
      );

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockRejectedValue(new Error('Storage error'));

      const result = await domainVerificationService.getDomainStats(
        'google.com',
      );

      expect(result).toBeNull();
    });

    it('should normalize domain in stats lookup', async () => {
      const timestamp = Date.now();
      const trustedDomains = [
        {
          domain: 'google.com',
          addedAt: timestamp,
          lastUsed: timestamp,
          useCount: 5,
          autoApproved: false,
        },
      ];
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockResolvedValue(JSON.stringify(trustedDomains));

      const result = await domainVerificationService.getDomainStats(
        'HTTPS://GOOGLE.COM/path',
      );

      expect(result?.useCount).toBe(5);
    });
  });

  describe('clearTrustedDomains', () => {
    it('should clear all trusted domains', async () => {
      (
        secureStorageModule.secureStorageService.removeItem as jest.Mock
      ).mockResolvedValue(undefined);

      await domainVerificationService.clearTrustedDomains();

      expect(
        secureStorageModule.secureStorageService.removeItem,
      ).toHaveBeenCalledWith('trusted_domains');
    });

    it('should handle clear errors', async () => {
      (
        secureStorageModule.secureStorageService.removeItem as jest.Mock
      ).mockRejectedValue(new Error('Storage error'));

      await expect(
        domainVerificationService.clearTrustedDomains(),
      ).rejects.toThrow();
    });
  });

  describe('exportTrustedDomains', () => {
    it('should export trusted domains as JSON', async () => {
      const timestamp = Date.now();
      const trustedDomains = [
        {
          domain: 'google.com',
          addedAt: timestamp,
          lastUsed: timestamp,
          useCount: 1,
          autoApproved: false,
        },
      ];
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockResolvedValue(JSON.stringify(trustedDomains));

      const result = await domainVerificationService.exportTrustedDomains();

      expect(result).toContain('google.com');
      expect(JSON.parse(result).length).toBe(1);
    });

    it('should handle export errors and return empty export', async () => {
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockRejectedValue(new Error('Storage error'));

      // Method catches errors internally and returns empty array
      const result = await domainVerificationService.exportTrustedDomains();

      expect(JSON.parse(result)).toEqual([]);
    });

    it('should export empty list if no domains', async () => {
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockResolvedValue(null);

      const result = await domainVerificationService.exportTrustedDomains();

      expect(JSON.parse(result)).toEqual([]);
    });
  });

  describe('importTrustedDomains', () => {
    it('should import trusted domains from JSON', async () => {
      const timestamp = Date.now();
      const domains = [
        {
          domain: 'example.com',
          addedAt: timestamp,
          lastUsed: timestamp,
          useCount: 1,
          autoApproved: false,
        },
      ];

      (
        secureStorageModule.secureStorageService.setItem as jest.Mock
      ).mockResolvedValue(undefined);

      await domainVerificationService.importTrustedDomains(
        JSON.stringify(domains),
      );

      expect(
        secureStorageModule.secureStorageService.setItem,
      ).toHaveBeenCalled();
    });

    it('should reject invalid JSON format', async () => {
      await expect(
        domainVerificationService.importTrustedDomains('invalid json'),
      ).rejects.toThrow();
    });

    it('should reject non-array data', async () => {
      await expect(
        domainVerificationService.importTrustedDomains(
          JSON.stringify({ data: [] }),
        ),
      ).rejects.toThrow();
    });

    it('should handle import errors', async () => {
      const timestamp = Date.now();
      const domains = [
        {
          domain: 'example.com',
          addedAt: timestamp,
          lastUsed: timestamp,
          useCount: 1,
          autoApproved: false,
        },
      ];

      (
        secureStorageModule.secureStorageService.setItem as jest.Mock
      ).mockRejectedValue(new Error('Storage error'));

      await expect(
        domainVerificationService.importTrustedDomains(JSON.stringify(domains)),
      ).rejects.toThrow();
    });

    it('should accept empty array', async () => {
      (
        secureStorageModule.secureStorageService.setItem as jest.Mock
      ).mockResolvedValue(undefined);

      await domainVerificationService.importTrustedDomains(JSON.stringify([]));

      expect(
        secureStorageModule.secureStorageService.setItem,
      ).toHaveBeenCalled();
    });
  });

  describe('verifyDomain', () => {
    it('should reject invalid domain format', async () => {
      const result = await domainVerificationService.verifyDomain(
        'invalid domain !@#',
      );

      expect(result.isValid).toBe(false);
    });

    it('should reject empty domain', async () => {
      const result = await domainVerificationService.verifyDomain('');

      expect(result.isValid).toBe(false);
    });

    it('should verify valid domain as not trusted initially', async () => {
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockResolvedValue(null);

      const result = await domainVerificationService.verifyDomain(
        'example.com',
      );

      expect(result.isValid).toBe(true);
      expect(result.isTrusted).toBe(false);
    });

    it('should verify well-known domain', async () => {
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockResolvedValue(null);

      const result = await domainVerificationService.verifyDomain('google.com');

      expect(result.isValid).toBe(true);
    });

    it('should verify trusted domain', async () => {
      const timestamp = Date.now();
      const trustedDomains = [
        {
          domain: 'example.com',
          addedAt: timestamp,
          lastUsed: timestamp,
          useCount: 1,
          autoApproved: false,
        },
      ];
      (
        secureStorageModule.secureStorageService.getItem as jest.Mock
      ).mockResolvedValue(JSON.stringify(trustedDomains));

      const result = await domainVerificationService.verifyDomain(
        'example.com',
      );

      expect(result.isValid).toBe(true);
      expect(result.isTrusted).toBe(true);
    });
  });
});
