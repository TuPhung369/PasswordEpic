import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';

interface AutoLockOption {
  label: string;
  value: number; // in minutes
  description: string;
  icon: string;
  securityLevel:
    | 'maximum'
    | 'high'
    | 'moderate'
    | 'balanced'
    | 'low'
    | 'convenience'
    | 'weekly'
    | 'biweekly'
    | 'monthly';
}

interface AutoLockSelectorProps {
  currentValue: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
}

const AUTO_LOCK_OPTIONS: AutoLockOption[] = [
  {
    label: '30 seconds',
    value: 0.5,
    description: 'Lock after 30 seconds of no user interaction',
    icon: 'security',
    securityLevel: 'maximum',
  },
  {
    label: '1 minute',
    value: 1,
    description: 'Lock after 1 minute of inactivity',
    icon: 'shield',
    securityLevel: 'high',
  },
  {
    label: '2 minutes',
    value: 2,
    description: 'Lock after 2 minutes without touches/taps',
    icon: 'timer',
    securityLevel: 'high',
  },
  {
    label: '5 minutes',
    value: 5,
    description: 'Lock after 5 minutes of no interaction',
    icon: 'access_time',
    securityLevel: 'moderate',
  },
  {
    label: '10 minutes',
    value: 10,
    description: 'Lock after 10 minutes without activity',
    icon: 'schedule',
    securityLevel: 'balanced',
  },
  {
    label: '15 minutes',
    value: 15,
    description: 'Lock after 15 minutes of no user input',
    icon: 'update',
    securityLevel: 'low',
  },
  {
    label: '30 minutes',
    value: 30,
    description: 'Lock after 30 minutes of inactivity',
    icon: 'event',
    securityLevel: 'convenience',
  },
];

const getSecurityLevelColor = (level: string): string => {
  switch (level) {
    case 'maximum':
      return '#E53E3E'; // Red
    case 'high':
      return '#FF8C00'; // Orange
    case 'moderate':
      return '#FFD700'; // Gold
    case 'balanced':
      return '#32CD32'; // Lime Green
    case 'low':
      return '#00CED1'; // Dark Turquoise
    case 'convenience':
      return '#1E90FF'; // Dodger Blue
    case 'weekly':
      return '#9370DB'; // Medium Purple
    case 'biweekly':
      return '#8A2BE2'; // Blue Violet
    case 'monthly':
      return '#4B0082'; // Indigo
    default:
      return '#32CD32';
  }
};

const getSecurityLevelLabel = (level: string): string => {
  switch (level) {
    case 'maximum':
      return 'Maximum Security';
    case 'high':
      return 'High Security';
    case 'moderate':
      return 'Moderate Security';
    case 'balanced':
      return 'Balanced Security';
    case 'low':
      return 'Low Security';
    case 'convenience':
      return 'Convenience Mode';
    case 'weekly':
      return 'Weekly Lock';
    case 'biweekly':
      return 'Bi-weekly Lock';
    case 'monthly':
      return 'Monthly Lock';
    default:
      return 'Balanced Security';
  }
};

export const AutoLockSelector: React.FC<AutoLockSelectorProps> = ({
  currentValue,
  onValueChange,
  disabled = false,
}) => {
  const { theme } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const scrollViewRef = React.useRef<ScrollView>(null);

  const handleSelect = (option: AutoLockOption) => {
    onValueChange(option.value);
    setIsVisible(false);
  };

  // Scroll to current option when modal opens
  const handleModalOpen = () => {
    setIsVisible(true);
    setTimeout(() => {
      const currentIndex = AUTO_LOCK_OPTIONS.findIndex(
        opt => opt.value === currentValue,
      );
      if (currentIndex > 0 && scrollViewRef.current) {
        scrollViewRef.current.scrollTo({
          y: currentIndex * 80, // minHeight of optionItem
          animated: true,
        });
      }
    }, 300);
  };

  return (
    <>
      {/* Dropdown Trigger */}
      <TouchableOpacity
        style={[
          styles.dropdownTrigger,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
          disabled && styles.disabled,
        ]}
        onPress={() => !disabled && handleModalOpen()}
        activeOpacity={0.7}
      >
        <View style={styles.triggerContent}>
          <View style={styles.triggerLeft}>
            <MaterialIcons name="timer" size={24} color={theme.primary} />
            <View style={styles.triggerTextContainer}>
              <Text
                style={[styles.triggerTitle, { color: theme.text }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Auto-Lock
              </Text>
              <Text
                style={[styles.triggerSubtitle, { color: theme.textSecondary }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Biometric lock timeout
              </Text>
            </View>
          </View>
          <MaterialIcons
            name="keyboard-arrow-down"
            size={24}
            color={theme.textSecondary}
          />
        </View>
      </TouchableOpacity>

      {/* Dropdown Modal */}
      <Modal
        visible={isVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsVisible(false)}
        >
          <View
            style={[styles.modalContainer, { backgroundColor: theme.surface }]}
            onStartShouldSetResponder={() => true}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Auto-Lock Settings
              </Text>
              <Text
                style={[styles.modalSubtitle, { color: theme.textSecondary }]}
              >
                Choose when to automatically lock the app based on user
                inactivity
              </Text>
            </View>

            {/* Options List */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.optionsList}
              showsVerticalScrollIndicator={true}
              persistentScrollbar={true}
              bounces={true}
            >
              {AUTO_LOCK_OPTIONS.map((option, index) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionItem,
                    { borderBottomColor: theme.border },
                    currentValue === option.value && {
                      backgroundColor: theme.primary + '10',
                    },
                    index === AUTO_LOCK_OPTIONS.length - 1 && styles.lastOption,
                  ]}
                  onPress={() => handleSelect(option)}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionLeft}>
                    <MaterialIcons
                      name={option.icon as any}
                      size={24}
                      color={getSecurityLevelColor(option.securityLevel)}
                    />
                    <View style={styles.optionTextContainer}>
                      <Text style={[styles.optionTitle, { color: theme.text }]}>
                        {option.label}
                      </Text>
                      <Text
                        style={[
                          styles.optionDescription,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {option.description}
                      </Text>
                      <View style={styles.securityBadge}>
                        <View
                          style={[
                            styles.securityDot,
                            {
                              backgroundColor: getSecurityLevelColor(
                                option.securityLevel,
                              ),
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.securityLabel,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {getSecurityLevelLabel(option.securityLevel)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {currentValue === option.value && (
                    <MaterialIcons
                      name="check-circle"
                      size={24}
                      color={theme.primary}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Footer Info */}
            <View style={styles.modalFooter}>
              <View style={styles.footerItem}>
                <MaterialIcons
                  name="fingerprint"
                  size={16}
                  color={theme.primary}
                />
                <Text
                  style={[styles.footerText, { color: theme.textSecondary }]}
                >
                  Auto-lock triggers when you don't interact with the app
                </Text>
              </View>
              <View style={styles.footerItem}>
                <MaterialIcons
                  name="security"
                  size={16}
                  color={theme.primary}
                />
                <Text
                  style={[styles.footerText, { color: theme.textSecondary }]}
                >
                  Uses biometric authentication to unlock
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  dropdownTrigger: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 70, // Increase height to accommodate text better
  },
  disabled: {
    opacity: 0.6,
  },
  triggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46, // Ensure minimum height for content
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    overflow: 'hidden', // Prevent overflow
  },
  triggerTextContainer: {
    marginLeft: 12,
    flex: 1,
    marginRight: 8, // Add margin to prevent overlap with arrow
  },
  triggerTitle: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1, // Allow text to shrink if needed
  },
  triggerSubtitle: {
    fontSize: 12,
    marginTop: 2,
    flexShrink: 1, // Allow text to shrink if needed
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    maxHeight: Dimensions.get('window').height * 0.85,
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  optionsList: {
    maxHeight: 500,
    paddingVertical: 4,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    minHeight: 80,
  },
  lastOption: {
    borderBottomWidth: 0,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  securityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  securityLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  footerText: {
    fontSize: 12,
    lineHeight: 18,
    marginLeft: 8,
    flex: 1,
  },
});
