import { useState, useCallback } from 'react';
import { useBiometric } from './useBiometric';

export interface UsePasswordAuthenticationReturn {
  masterPassword: string | null;
  isAuthenticating: boolean;
  error: string | null;
  
  authenticate: () => Promise<string | null>;
  clearError: () => void;
  
  showBiometricPrompt: boolean;
  showFallbackModal: boolean;
  showPinPrompt: boolean;
  
  setShowBiometricPrompt: (show: boolean) => void;
  setShowFallbackModal: (show: boolean) => void;
  setShowPinPrompt: (show: boolean) => void;
  
  handleBiometricSuccess: () => void;
  handleBiometricError: (error: string) => void;
  handleBiometricClose: () => void;
  
  handleFallbackSuccess: (masterPassword: string) => void;
  handleFallbackCancel: () => void;
  
  handlePinPromptSuccess: (masterPassword: string) => void;
  handlePinPromptCancel: () => void;
}

export const usePasswordAuthentication = (): UsePasswordAuthenticationReturn => {
  const { authenticate: authenticateBiometric } = useBiometric();
  
  const [masterPassword, setMasterPassword] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [showFallbackModal, setShowFallbackModal] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  
  let authResolver: {
    resolve: (password: string) => void;
    reject: () => void;
  } | null = null;
  
  const authenticate = useCallback(async (): Promise<string | null> => {
    console.log('🔐 [usePasswordAuthentication] Starting 3-layer authentication...');
    
    setIsAuthenticating(true);
    setError(null);
    
    return new Promise<string | null>((resolve, reject) => {
      authResolver = {
        resolve: (password: string) => {
          setMasterPassword(password);
          setIsAuthenticating(false);
          resolve(password);
        },
        reject: () => {
          setIsAuthenticating(false);
          reject();
        },
      };
      
      setShowBiometricPrompt(true);
    });
  }, []);
  
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  const handleBiometricSuccess = useCallback(() => {
    console.log('✅ [usePasswordAuthentication] Biometric success, proceeding to PIN');
    setShowBiometricPrompt(false);
    setShowPinPrompt(true);
  }, []);
  
  const handleBiometricError = useCallback((error: string) => {
    console.log('❌ [usePasswordAuthentication] Biometric error:', error);
    setShowBiometricPrompt(false);
    setError(error);
    setShowFallbackModal(true);
  }, []);
  
  const handleBiometricClose = useCallback(() => {
    console.log('👤 [usePasswordAuthentication] Biometric closed, showing fallback');
    setShowBiometricPrompt(false);
    setShowFallbackModal(true);
  }, []);
  
  const handleFallbackSuccess = useCallback((password: string) => {
    console.log('✅ [usePasswordAuthentication] Fallback success, resolving authentication');
    setShowFallbackModal(false);
    if (authResolver) {
      authResolver.resolve(password);
      authResolver = null;
    }
  }, []);
  
  const handleFallbackCancel = useCallback(() => {
    console.log('❌ [usePasswordAuthentication] Fallback cancelled');
    setShowFallbackModal(false);
    setError('Authentication cancelled');
    if (authResolver) {
      authResolver.reject();
      authResolver = null;
    }
    setIsAuthenticating(false);
  }, []);
  
  const handlePinPromptSuccess = useCallback((password: string) => {
    console.log('✅ [usePasswordAuthentication] PIN success, resolving authentication');
    setShowPinPrompt(false);
    if (authResolver) {
      authResolver.resolve(password);
      authResolver = null;
    }
  }, []);
  
  const handlePinPromptCancel = useCallback(() => {
    console.log('❌ [usePasswordAuthentication] PIN cancelled');
    setShowPinPrompt(false);
    setError('Authentication cancelled');
    if (authResolver) {
      authResolver.reject();
      authResolver = null;
    }
    setIsAuthenticating(false);
  }, []);
  
  return {
    masterPassword,
    isAuthenticating,
    error,
    
    authenticate,
    clearError,
    
    showBiometricPrompt,
    showFallbackModal,
    showPinPrompt,
    
    setShowBiometricPrompt,
    setShowFallbackModal,
    setShowPinPrompt,
    
    handleBiometricSuccess,
    handleBiometricError,
    handleBiometricClose,
    
    handleFallbackSuccess,
    handleFallbackCancel,
    
    handlePinPromptSuccess,
    handlePinPromptCancel,
  };
};
