import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  BackHandler,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useSession } from '../hooks/useSession';
import { useTheme } from '../contexts/ThemeContext';

interface SessionTimeoutModalProps {
  visible: boolean;
  timeRemaining: number;
  onExtend: () => void;
  onLogout: () => void;
}

export const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({
  visible,
  timeRemaining,
  onExtend,
  onLogout,
}) => {
  const { theme } = useTheme();
  const session = useSelector((state: RootState) => state.auth.session);
  const { extendSession, forceLogout } = useSession();

  React.useEffect(() => {
    if (visible) {
      const backAction = () => {
        // Prevent back button from closing modal
        return true;
      };

      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        backAction,
      );
      return () => backHandler.remove();
    }
  }, [visible]);

  const handleExtendSession = async () => {
    try {
      await extendSession(15); // Extend by 15 minutes
      onExtend();
    } catch (error) {
      Alert.alert('Error', 'Failed to extend session. Please log in again.', [
        { text: 'OK', onPress: onLogout },
      ]);
    }
  };

  const handleLogout = async () => {
    console.log('🔐 SessionTimeoutModal: User clicked logout');
    try {
      await forceLogout();
      console.log('🔐 SessionTimeoutModal: forceLogout completed');
      onLogout();
    } catch (error) {
      console.error('Failed to logout:', error);
      onLogout(); // Force logout anyway
    }
  };

  const formatTime = (milliseconds: number): string => {
    if (milliseconds <= 0) return '0:00';

    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!visible) return null;

  const isExpired = session.expired || timeRemaining <= 0;
  const timeDisplayed = isExpired ? 0 : timeRemaining;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      hardwareAccelerated={true}
      statusBarTranslucent={true}
      onRequestClose={() => {
        // Prevent modal from being closed
        return;
      }}
    >
      <View style={styles.overlay}>
        <View
          style={[styles.modalContainer, { backgroundColor: theme.surface }]}
        >
          {/* Warning Icon */}
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: theme.warning + '20' },
            ]}
          >
            <Text style={[styles.warningIcon, { color: theme.warning }]}>
              ⚠️
            </Text>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: theme.text }]}>
            {isExpired ? 'Session Expired' : 'Session Timeout Warning'}
          </Text>

          {/* Message */}
          <Text style={[styles.message, { color: theme.textSecondary }]}>
            {isExpired
              ? 'Your session has expired for security. Please log in again to continue.'
              : `Your session will expire in ${formatTime(
                  timeDisplayed,
                )} due to inactivity. Would you like to extend it?`}
          </Text>

          {/* Timer Display */}
          {!isExpired && (
            <View
              style={[
                styles.timerContainer,
                { backgroundColor: theme.background },
              ]}
            >
              <Text style={[styles.timerLabel, { color: theme.textSecondary }]}>
                Time Remaining
              </Text>
              <Text style={[styles.timerText, { color: theme.error }]}>
                {formatTime(timeDisplayed)}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {isExpired ? (
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.primaryButton,
                  { backgroundColor: theme.primary },
                ]}
                onPress={handleLogout}
                activeOpacity={0.8}
              >
                <Text style={[styles.buttonText, { color: theme.text }]}>
                  Log In Again
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.secondaryButton,
                    { borderColor: theme.border },
                  ]}
                  onPress={handleLogout}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.buttonText, { color: theme.text }]}>
                    Logout
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.primaryButton,
                    { backgroundColor: theme.primary },
                  ]}
                  onPress={handleExtendSession}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.buttonText, { color: theme.text }]}>
                    Extend Session
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Security Notice */}
          <Text style={[styles.securityNotice, { color: theme.textSecondary }]}>
            🔒 This timeout protects your passwords when inactive
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  warningIcon: {
    fontSize: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  timerContainer: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
    minWidth: 120,
  },
  timerLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timerText: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButton: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  secondaryButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  securityNotice: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default SessionTimeoutModal;
