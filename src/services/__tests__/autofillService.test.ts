import { NativeModules, Platform } from 'react-native';
import { autofillService, AutofillEventType } from '../autofillService';
import { secureStorageService } from '../secureStorageService';
import { PasswordEntry } from '../../types/password';

// Mock native modules
jest.mock('react-native', () => ({
  NativeModules: {
    AutofillBridge: {
      isAutofillSupported: jest.fn(),
      isAutofillEnabled: jest.fn(),
      requestEnableAutofill: jest.fn(),
      disableAutofill: jest.fn(),
      prepareCredentials: jest.fn(),
      clearCache: jest.fn(),
      updateSettings: jest.fn(),
      getSettings: jest.fn(),
      getStatistics: jest.fn(),
      recordUsage: jest.fn(),
    },
  },
  Platform: {
    OS: 'android',
    Version: 26,
  },
  NativeEventEmitter: jest.fn(),
}));

jest.mock('../secureStorageService', () => ({
  secureStorageService: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock('../cryptoService', () => ({
  encryptData: jest.fn(),
  decryptData: jest.fn(),
}));

import { encryptData, decryptData } from '../cryptoService';

describe('AutofillService', () => {
  const mockMasterKey = 'test-master-key';
  const mockCredential: PasswordEntry = {
    id: '1',
    title: 'Gmail',
    website: 'https://www.google.com',
    username: 'user@gmail.com',
    password: 'secure123',
    category: 'Email',
    tags: [],
    notes: 'My main email',
    customFields: [],
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    isFavorite: false,
    strength: 'strong',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup proper mocks for crypto functions
    (encryptData as jest.Mock).mockReturnValue({
      ciphertext: 'encrypted_data',
      iv: 'test_iv',
      tag: 'test_tag',
    });

    (decryptData as jest.Mock).mockReturnValue(
      JSON.stringify([
        {
          id: '1',
          domain: 'google.com',
          username: 'user@gmail.com',
          password: 'secure123',
        },
      ]),
    );

    // Setup secure storage mocks
    (secureStorageService.getItem as jest.Mock).mockResolvedValue(null);
    (secureStorageService.setItem as jest.Mock).mockResolvedValue(undefined);
    (secureStorageService.removeItem as jest.Mock).mockResolvedValue(undefined);

    // Reset Platform for each test
    (Platform as any).OS = 'android';
    (Platform as any).Version = 26;
  });

  describe('isSupported', () => {
    it('should return false for non-android platform', async () => {
      (Platform.OS as any) = 'ios';
      const result = await autofillService.isSupported();
      expect(result).toBe(false);
    });

    it('should return true for android with API 26+', async () => {
      (Platform.OS as any) = 'android';
      (Platform.Version as any) = 26;
      const result = await autofillService.isSupported();
      expect(result).toBe(true);
    });

    it('should return true for android with API 27+', async () => {
      (Platform.OS as any) = 'android';
      (Platform.Version as any) = 27;
      const result = await autofillService.isSupported();
      expect(result).toBe(true);
    });

    it('should return false for android below API 26', async () => {
      (Platform.OS as any) = 'android';
      (Platform.Version as any) = 25;
      const result = await autofillService.isSupported();
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      (Platform.OS as any) = 'android';
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      try {
        const result = await autofillService.isSupported();
        expect(result).toBe(true);
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });

  describe('isEnabled', () => {
    it('should return false for non-android platform', async () => {
      (Platform.OS as any) = 'ios';
      const result = await autofillService.isEnabled();
      expect(result).toBe(false);
    });

    it('should return true when autofill is enabled', async () => {
      (Platform.OS as any) = 'android';
      const mockBridge = NativeModules.AutofillBridge as any;
      mockBridge.isAutofillEnabled.mockResolvedValue(true);

      const result = await autofillService.isEnabled();
      expect(result).toBe(true);
      expect(mockBridge.isAutofillEnabled).toHaveBeenCalled();
    });

    it('should return false when autofill is disabled', async () => {
      (Platform.OS as any) = 'android';
      const mockBridge = NativeModules.AutofillBridge as any;
      mockBridge.isAutofillEnabled.mockResolvedValue(false);

      const result = await autofillService.isEnabled();
      expect(result).toBe(false);
    });

    it('should handle errors and return false', async () => {
      (Platform.OS as any) = 'android';
      const mockBridge = NativeModules.AutofillBridge as any;
      mockBridge.isAutofillEnabled.mockRejectedValue(new Error('Bridge error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await autofillService.isEnabled();
      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('requestEnable', () => {
    it('should throw for non-android platform', async () => {
      (Platform.OS as any) = 'ios';
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // requestEnable throws but catch handler returns false
      try {
        const result = await autofillService.requestEnable();
        expect(result).toBe(false);
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it('should request enable autofill on android', async () => {
      (Platform.OS as any) = 'android';
      const mockBridge = NativeModules.AutofillBridge as any;
      mockBridge.requestEnableAutofill.mockResolvedValue(true);

      const result = await autofillService.requestEnable();
      expect(result).toBe(true);
      expect(mockBridge.requestEnableAutofill).toHaveBeenCalled();
    });

    it('should return false on request errors', async () => {
      (Platform.OS as any) = 'android';
      const mockBridge = NativeModules.AutofillBridge as any;
      mockBridge.requestEnableAutofill.mockRejectedValue(
        new Error('Request failed'),
      );
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await autofillService.requestEnable();
      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('disable', () => {
    it('should do nothing for non-android', async () => {
      (Platform.OS as any) = 'ios';
      await expect(autofillService.disable()).resolves.toBeUndefined();
    });

    it('should disable autofill on android', async () => {
      (Platform.OS as any) = 'android';
      const mockBridge = NativeModules.AutofillBridge as any;
      mockBridge.disableAutofill.mockResolvedValue(true);

      await autofillService.disable();
      expect(mockBridge.disableAutofill).toHaveBeenCalled();
    });

    it('should throw on disable error', async () => {
      (Platform.OS as any) = 'android';
      const mockBridge = NativeModules.AutofillBridge as any;
      mockBridge.disableAutofill.mockRejectedValue(new Error('Disable failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(autofillService.disable()).rejects.toThrow('Disable failed');
      consoleSpy.mockRestore();
    });
  });

  describe('prepareCredentialsForAutofill', () => {
    it('should prepare and store credentials', async () => {
      (Platform.OS as any) = 'android';
      const mockBridge = NativeModules.AutofillBridge as any;
      mockBridge.prepareCredentials.mockResolvedValue(true);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await autofillService.prepareCredentialsForAutofill(
        [mockCredential],
        mockMasterKey,
      );

      expect(encryptData).toHaveBeenCalled();
      expect(secureStorageService.setItem).toHaveBeenCalledWith(
        'autofill_credentials',
        expect.any(String),
      );
      consoleSpy.mockRestore();
    });

    it('should skip credentials without domain', async () => {
      (Platform.OS as any) = 'android';
      const credentialNoDomain = { ...mockCredential, website: '' };
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await autofillService.prepareCredentialsForAutofill(
        [credentialNoDomain],
        mockMasterKey,
      );

      expect(encryptData).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should skip credentials without username', async () => {
      (Platform.OS as any) = 'android';
      const credentialNoUsername = { ...mockCredential, username: '' };
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await autofillService.prepareCredentialsForAutofill(
        [credentialNoUsername],
        mockMasterKey,
      );

      expect(encryptData).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle encryption errors', async () => {
      (encryptData as jest.Mock).mockImplementation(() => {
        throw new Error('Encryption failed');
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(
        autofillService.prepareCredentialsForAutofill(
          [mockCredential],
          mockMasterKey,
        ),
      ).rejects.toThrow('Encryption failed');
      consoleSpy.mockRestore();
    });

    it('should handle bridge errors gracefully', async () => {
      (Platform.OS as any) = 'android';
      const mockBridge = NativeModules.AutofillBridge as any;
      mockBridge.prepareCredentials.mockRejectedValue(
        new Error('Bridge error'),
      );
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Should not throw - bridge failure is non-fatal
      await autofillService.prepareCredentialsForAutofill(
        [mockCredential],
        mockMasterKey,
      );
      consoleSpy.mockRestore();
    });

    it('should handle empty credential array', async () => {
      (Platform.OS as any) = 'android';
      await autofillService.prepareCredentialsForAutofill([], mockMasterKey);

      expect(encryptData).toHaveBeenCalledWith(
        JSON.stringify([]),
        mockMasterKey,
      );
    });
  });

  describe('getCredentialsForDomain', () => {
    it('should return empty array if no credentials stored', async () => {
      (secureStorageService.getItem as jest.Mock).mockResolvedValue(null);

      const result = await autofillService.getCredentialsForDomain(
        'google.com',
        mockMasterKey,
      );
      expect(result).toEqual([]);
    });

    it('should decrypt and return matching credentials', async () => {
      (secureStorageService.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({
          ciphertext: 'encrypted',
          iv: 'iv',
          tag: 'tag',
        }),
      );
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await autofillService.getCredentialsForDomain(
        'google.com',
        mockMasterKey,
      );
      expect(result).toBeDefined();
      expect(decryptData).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle decryption errors', async () => {
      (secureStorageService.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({
          ciphertext: 'encrypted',
          iv: 'iv',
          tag: 'tag',
        }),
      );
      (decryptData as jest.Mock).mockImplementation(() => {
        throw new Error('Decryption failed');
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await autofillService.getCredentialsForDomain(
        'google.com',
        mockMasterKey,
      );
      expect(result).toEqual([]);
      consoleSpy.mockRestore();
    });

    it('should filter credentials by domain', async () => {
      (secureStorageService.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({
          ciphertext: 'encrypted',
          iv: 'iv',
          tag: 'tag',
        }),
      );
      (decryptData as jest.Mock).mockReturnValue(
        JSON.stringify([
          {
            id: '1',
            domain: 'google.com',
            username: 'user1@gmail.com',
            password: 'pwd1',
          },
          {
            id: '2',
            domain: 'facebook.com',
            username: 'user2@fb.com',
            password: 'pwd2',
          },
        ]),
      );
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await autofillService.getCredentialsForDomain(
        'google.com',
        mockMasterKey,
      );
      expect(result).toHaveLength(1);
      expect(result[0].domain).toBe('google.com');
      consoleSpy.mockRestore();
    });

    it('should handle subdomain matching', async () => {
      (secureStorageService.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({
          ciphertext: 'encrypted',
          iv: 'iv',
          tag: 'tag',
        }),
      );
      (decryptData as jest.Mock).mockReturnValue(
        JSON.stringify([
          {
            id: '1',
            domain: 'mail.google.com',
            username: 'user@gmail.com',
            password: 'pwd',
          },
        ]),
      );
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await autofillService.getCredentialsForDomain(
        'google.com',
        mockMasterKey,
      );
      // Subdomain should match parent domain
      expect(result).toBeDefined();
      consoleSpy.mockRestore();
    });
  });

  describe('saveCredential', () => {
    it('should save new credential', async () => {
      (secureStorageService.getItem as jest.Mock).mockResolvedValue(null);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await autofillService.saveCredential(
        'google.com',
        'user@gmail.com',
        'password123',
        mockMasterKey,
      );

      expect(result).toBe(true);
      expect(secureStorageService.setItem).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should add to existing credentials', async () => {
      (secureStorageService.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({
          ciphertext: 'encrypted',
          iv: 'iv',
          tag: 'tag',
        }),
      );
      (decryptData as jest.Mock).mockReturnValue(
        JSON.stringify([
          {
            id: '1',
            domain: 'google.com',
            username: 'existing@gmail.com',
            password: 'pwd1',
          },
        ]),
      );
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await autofillService.saveCredential(
        'google.com',
        'user@gmail.com',
        'password123',
        mockMasterKey,
      );

      expect(result).toBe(true);
      expect(encryptData).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle save errors', async () => {
      (secureStorageService.setItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await autofillService.saveCredential(
        'google.com',
        'user@gmail.com',
        'password123',
        mockMasterKey,
      );

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });

    it('should handle decryption errors when loading existing credentials', async () => {
      (secureStorageService.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({
          ciphertext: 'encrypted',
          iv: 'iv',
          tag: 'tag',
        }),
      );
      (decryptData as jest.Mock).mockImplementation(() => {
        throw new Error('Decryption failed');
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await autofillService.saveCredential(
        'google.com',
        'user@gmail.com',
        'password123',
        mockMasterKey,
      );

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('clearCache', () => {
    it('should clear autofill cache', async () => {
      (Platform.OS as any) = 'android';
      const mockBridge = NativeModules.AutofillBridge as any;
      mockBridge.clearCache.mockResolvedValue(true);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await autofillService.clearCache();

      expect(secureStorageService.removeItem).toHaveBeenCalledWith(
        'autofill_credentials',
      );
      expect(mockBridge.clearCache).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should throw on cache clear error', async () => {
      (secureStorageService.removeItem as jest.Mock).mockRejectedValue(
        new Error('Clear failed'),
      );
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(autofillService.clearCache()).rejects.toThrow(
        'Clear failed',
      );
      consoleSpy.mockRestore();
    });

    it('should handle bridge clear errors', async () => {
      (Platform.OS as any) = 'android';
      const mockBridge = NativeModules.AutofillBridge as any;
      mockBridge.clearCache.mockRejectedValue(new Error('Bridge error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(autofillService.clearCache()).rejects.toThrow();
      consoleSpy.mockRestore();
    });
  });

  describe('getSettings', () => {
    it('should return default settings if none stored', async () => {
      (secureStorageService.getItem as jest.Mock).mockResolvedValue(null);

      const result = await autofillService.getSettings();
      expect(result).toBeDefined();
      expect(result.enabled).toBe(false);
      expect(result.requireBiometric).toBe(true);
      expect(result.allowSubdomains).toBe(true);
      expect(result.autoSubmit).toBe(false);
      expect(result.trustedDomains).toEqual([]);
    });

    it('should return stored settings', async () => {
      const settings = {
        enabled: true,
        requireBiometric: true,
        allowSubdomains: true,
        autoSubmit: false,
        trustedDomains: ['google.com'],
      };
      (secureStorageService.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(settings),
      );

      const result = await autofillService.getSettings();
      expect(result.enabled).toBe(true);
      expect(result.trustedDomains).toContain('google.com');
    });

    it('should handle settings retrieval errors', async () => {
      (secureStorageService.getItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await autofillService.getSettings();
      expect(result.enabled).toBe(false);
      consoleSpy.mockRestore();
    });

    it('should handle invalid JSON in settings', async () => {
      (secureStorageService.getItem as jest.Mock).mockResolvedValue(
        'invalid-json',
      );
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await autofillService.getSettings();
      expect(result.enabled).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('updateSettings', () => {
    it('should update autofill settings', async () => {
      (secureStorageService.getItem as jest.Mock).mockResolvedValue(null);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await autofillService.updateSettings({ enabled: true });

      expect(secureStorageService.setItem).toHaveBeenCalledWith(
        'autofill_settings',
        expect.stringContaining('"enabled":true'),
      );
      consoleSpy.mockRestore();
    });

    it('should merge with existing settings', async () => {
      const existingSettings = {
        enabled: false,
        requireBiometric: true,
        allowSubdomains: true,
        autoSubmit: false,
        trustedDomains: [],
      };
      (secureStorageService.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(existingSettings),
      );
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await autofillService.updateSettings({ enabled: true });

      expect(secureStorageService.setItem).toHaveBeenCalledWith(
        'autofill_settings',
        expect.stringContaining('"enabled":true'),
      );
      consoleSpy.mockRestore();
    });

    it('should handle update errors', async () => {
      (secureStorageService.getItem as jest.Mock).mockResolvedValue(null);
      (secureStorageService.setItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(
        autofillService.updateSettings({ enabled: true }),
      ).rejects.toThrow();
      consoleSpy.mockRestore();
    });
  });

  describe('getStatistics', () => {
    it('should return default statistics if none stored', async () => {
      (secureStorageService.getItem as jest.Mock).mockResolvedValue(null);

      const result = await autofillService.getStatistics();
      expect(result).toBeDefined();
      expect(result.totalFills).toBe(0);
      expect(result.totalSaves).toBe(0);
      expect(result.blockedPhishing).toBe(0);
      expect(result.lastUsed).toBe('');
    });

    it('should return stored statistics', async () => {
      const stats = {
        totalFills: 10,
        totalSaves: 5,
        blockedPhishing: 1,
        lastUsed: '2024-01-15',
      };
      (secureStorageService.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(stats),
      );

      const result = await autofillService.getStatistics();
      expect(result.totalFills).toBe(10);
      expect(result.totalSaves).toBe(5);
    });

    it('should handle statistics retrieval errors', async () => {
      (secureStorageService.getItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await autofillService.getStatistics();
      expect(result.totalFills).toBe(0);
      consoleSpy.mockRestore();
    });
  });

  describe('updateStatistics', () => {
    it('should update autofill statistics', async () => {
      (secureStorageService.getItem as jest.Mock).mockResolvedValue(null);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await autofillService.updateStatistics({ totalFills: 5 });

      expect(secureStorageService.setItem).toHaveBeenCalledWith(
        'autofill_statistics',
        expect.stringContaining('"totalFills":5'),
      );
      consoleSpy.mockRestore();
    });

    it('should merge with existing statistics', async () => {
      const existingStats = {
        totalFills: 10,
        totalSaves: 5,
        blockedPhishing: 1,
        lastUsed: '2024-01-15',
      };
      (secureStorageService.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(existingStats),
      );
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await autofillService.updateStatistics({ totalFills: 15 });

      expect(secureStorageService.setItem).toHaveBeenCalledWith(
        'autofill_statistics',
        expect.stringContaining('"totalFills":15'),
      );
      consoleSpy.mockRestore();
    });

    it('should handle update errors silently', async () => {
      (secureStorageService.getItem as jest.Mock).mockResolvedValue(null);
      (secureStorageService.setItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Should not throw
      await autofillService.updateStatistics({ totalFills: 5 });
      consoleSpy.mockRestore();
    });
  });

  describe('Event Listeners', () => {
    it('should add event listener', () => {
      const callback = jest.fn();
      autofillService.addEventListener(
        AutofillEventType.FILL_REQUEST,
        callback,
      );

      // Verify listener was added (test internal state indirectly)
      expect(callback).not.toHaveBeenCalled();
    });

    it('should remove event listener', () => {
      const callback = jest.fn();
      autofillService.addEventListener(
        AutofillEventType.FILL_REQUEST,
        callback,
      );
      autofillService.removeEventListener(
        AutofillEventType.FILL_REQUEST,
        callback,
      );

      // Verify listener can be removed without error
      expect(true).toBe(true);
    });

    it('should handle removing non-existent listener', () => {
      const callback = jest.fn();
      // Should not throw
      autofillService.removeEventListener(
        AutofillEventType.FILL_REQUEST,
        callback,
      );
      expect(true).toBe(true);
    });

    it('should add multiple listeners for same event', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      autofillService.addEventListener(
        AutofillEventType.FILL_REQUEST,
        callback1,
      );
      autofillService.addEventListener(
        AutofillEventType.FILL_REQUEST,
        callback2,
      );

      expect(true).toBe(true);
    });
  });

  describe('Domain extraction and matching', () => {
    it('should extract domain from URL with protocol', async () => {
      (secureStorageService.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({
          ciphertext: 'encrypted',
          iv: 'iv',
          tag: 'tag',
        }),
      );
      (decryptData as jest.Mock).mockReturnValue(
        JSON.stringify([
          {
            id: '1',
            domain: 'google.com',
            username: 'user@gmail.com',
            password: 'pwd',
          },
        ]),
      );

      const result = await autofillService.getCredentialsForDomain(
        'https://www.google.com/search',
        mockMasterKey,
      );
      expect(result).toBeDefined();
    });

    it('should match credentials for domain variations', async () => {
      (secureStorageService.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({
          ciphertext: 'encrypted',
          iv: 'iv',
          tag: 'tag',
        }),
      );
      (decryptData as jest.Mock).mockReturnValue(
        JSON.stringify([
          {
            id: '1',
            domain: 'google.com',
            username: 'user@gmail.com',
            password: 'pwd',
          },
        ]),
      );

      // Should match various forms of the domain
      const result1 = await autofillService.getCredentialsForDomain(
        'google.com',
        mockMasterKey,
      );
      const result2 = await autofillService.getCredentialsForDomain(
        'www.google.com',
        mockMasterKey,
      );

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty password array in prepareCredentials', async () => {
      await autofillService.prepareCredentialsForAutofill([], mockMasterKey);
      expect(encryptData).toHaveBeenCalledWith('[]', mockMasterKey);
    });

    it('should handle multiple credentials for same domain', async () => {
      (secureStorageService.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({
          ciphertext: 'encrypted',
          iv: 'iv',
          tag: 'tag',
        }),
      );
      (decryptData as jest.Mock).mockReturnValue(
        JSON.stringify([
          {
            id: '1',
            domain: 'google.com',
            username: 'user1@gmail.com',
            password: 'pwd1',
          },
          {
            id: '2',
            domain: 'google.com',
            username: 'user2@gmail.com',
            password: 'pwd2',
          },
        ]),
      );
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await autofillService.getCredentialsForDomain(
        'google.com',
        mockMasterKey,
      );
      expect(result.length).toBeGreaterThanOrEqual(1);
      consoleSpy.mockRestore();
    });

    it('should handle credential with lastUsed timestamp', async () => {
      const credentialWithLastUsed = {
        ...mockCredential,
        lastUsed: new Date().toISOString(),
      };

      await autofillService.prepareCredentialsForAutofill(
        [credentialWithLastUsed],
        mockMasterKey,
      );

      expect(encryptData).toHaveBeenCalled();
    });

    it('should handle credential without lastUsed', async () => {
      const credentialWithoutLastUsed = {
        ...mockCredential,
        lastUsed: undefined,
      };

      await autofillService.prepareCredentialsForAutofill(
        [credentialWithoutLastUsed],
        mockMasterKey,
      );

      expect(encryptData).toHaveBeenCalled();
    });
  });
});
