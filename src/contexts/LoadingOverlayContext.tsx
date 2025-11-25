import React, { createContext, useContext, useState } from 'react';
import { LoadingScreen } from '../components/LoadingScreen';

interface LoadingOverlayContextType {
  show: () => void;
  hide: () => void;
  isVisible: boolean;
}

const LoadingOverlayContext = createContext<LoadingOverlayContextType | undefined>(undefined);

export const LoadingOverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isVisible, setIsVisible] = useState(false);

  const show = () => setIsVisible(true);
  const hide = () => setIsVisible(false);

  return (
    <LoadingOverlayContext.Provider value={{ show, hide, isVisible }}>
      {children}
      <LoadingScreen visible={isVisible} />
    </LoadingOverlayContext.Provider>
  );
};

export const useLoadingOverlay = () => {
  const context = useContext(LoadingOverlayContext);
  if (!context) {
    throw new Error('useLoadingOverlay must be used within LoadingOverlayProvider');
  }
  return context;
};
