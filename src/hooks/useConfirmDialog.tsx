import { useState } from 'react';

export interface ConfirmDialogConfig {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  confirmText?: string;
  confirmStyle?: 'default' | 'destructive';
}

export const useConfirmDialog = () => {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogConfig>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showConfirm = (config: Omit<ConfirmDialogConfig, 'visible'>) => {
    setConfirmDialog({
      ...config,
      visible: true,
    });
  };

  const hideConfirm = () => {
    setConfirmDialog(prev => ({ ...prev, visible: false }));
  };

  const showAlert = (title: string, message: string, confirmText = 'OK') => {
    setConfirmDialog({
      visible: true,
      title,
      message,
      confirmText,
      confirmStyle: 'default',
      onConfirm: hideConfirm,
    });
  };

  const showDestructive = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText = 'Delete',
  ) => {
    setConfirmDialog({
      visible: true,
      title,
      message,
      confirmText,
      confirmStyle: 'destructive',
      onConfirm: () => {
        hideConfirm();
        onConfirm();
      },
    });
  };

  return {
    confirmDialog,
    showConfirm,
    hideConfirm,
    showAlert,
    showDestructive,
  };
};
