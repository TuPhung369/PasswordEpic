import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  BiometricService,
  BiometricCapability,
} from '../services/biometricService';

interface BiometricContextType {
  isAvailable: boolean;
  isSetup: boolean;
  biometryType: string;
  isLoading: boolean;
  error: string | null;
  refreshCapability: () => Promise<void>;
  clearError: () => void;
}

const BiometricContext = createContext<BiometricContextType | undefined>(
  undefined,
);

export const BiometricProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isSetup, setIsSetup] = useState<boolean>(false);
  const [biometryType, setBiometryType] = useState<string>(
    'Biometric Authentication',
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const checkCapability = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const biometricService = BiometricService.getInstance();

      const capability: BiometricCapability =
        await biometricService.checkBiometricCapability();

      setIsAvailable(capability.available);

      if (capability.available && capability.biometryType) {
        const typeName = biometricService.getBiometricTypeName(
          capability.biometryType,
        );
        setBiometryType(typeName);
      }

      if (capability.available) {
        const setupStatus = await biometricService.isBiometricSetup();
        setIsSetup(setupStatus);
      } else {
        setIsSetup(false);
      }

      if (capability.error) {
        setError(capability.error);
      }
    } catch (err) {
      console.error('Error checking biometric capability:', err);
      setError('Failed to check biometric capability');
      setIsAvailable(false);
      setIsSetup(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  useEffect(() => {
    checkCapability();
  }, [checkCapability]);

  const value: BiometricContextType = {
    isAvailable,
    isSetup,
    biometryType,
    isLoading,
    error,
    refreshCapability: checkCapability,
    clearError,
  };

  return (
    <BiometricContext.Provider value={value}>
      {children}
    </BiometricContext.Provider>
  );
};

export const useBiometricContext = (): BiometricContextType => {
  const context = useContext(BiometricContext);
  if (!context) {
    throw new Error('useBiometricContext must be used within a BiometricProvider');
  }
  return context;
};
