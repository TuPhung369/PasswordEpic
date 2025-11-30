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
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

interface AutoLockOption {
  labelKey: string;
  value: number; // in minutes
  descriptionKey: string;
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
    labelKey: 'autolock.30_seconds',
    value: 0.5,
    descriptionKey: 'autolock.desc_30_seconds',
    icon: 'shield-checkmark-outline',
    securityLevel: 'maximum',
  },
  {
    labelKey: 'autolock.1_minute',
    value: 1,
    descriptionKey: 'autolock.desc_1_minute',
    icon: 'shield-outline',
    securityLevel: 'high',
  },
  {
    labelKey: 'autolock.2_minutes',
    value: 2,
    descriptionKey: 'autolock.desc_2_minutes',
    icon: 'timer-outline',
    securityLevel: 'high',
  },
  {
    labelKey: 'autolock.5_minutes',
    value: 5,
    descriptionKey: 'autolock.desc_5_minutes',
    icon: 'time-outline',
    securityLevel: 'moderate',
  },
  {
    labelKey: 'autolock.10_minutes',
    value: 10,
    descriptionKey: 'autolock.desc_10_minutes',
    icon: 'time-outline',
    securityLevel: 'balanced',
  },
  {
    labelKey: 'autolock.15_minutes',
    value: 15,
    descriptionKey: 'autolock.desc_15_minutes',
    icon: 'refresh-outline',
    securityLevel: 'low',
  },
  {
    labelKey: 'autolock.30_minutes',
    value: 30,
    descriptionKey: 'autolock.desc_30_minutes',
    icon: 'calendar-outline',
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

const getSecurityLevelLabel = (level: string, t: any): string => {
  switch (level) {
    case 'maximum':
      return t('autolock.security_maximum');
    case 'high':
      return t('autolock.security_high');
    case 'moderate':
      return t('autolock.security_moderate');
    case 'balanced':
      return t('autolock.security_balanced');
    case 'low':
      return t('autolock.security_low');
    case 'convenience':
      return t('autolock.security_convenience');
    case 'weekly':
      return t('autolock.security_weekly');
    case 'biweekly':
      return t('autolock.security_biweekly');
    case 'monthly':
      return t('autolock.security_monthly');
    default:
      return t('autolock.security_balanced');
  }
};

export const AutoLockSelector: React.FC<AutoLockSelectorProps> = ({
  currentValue,
  onValueChange,
  disabled = false,
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
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

  const currentOption = AUTO_LOCK_OPTIONS.find(
    opt => opt.value === currentValue,
  );

  return (
    <>
      {/* Dropdown Trigger */}
      <TouchableOpacity
        style={[styles.dropdownTrigger, disabled && styles.disabled]}
        onPress={() => !disabled && handleModalOpen()}
        activeOpacity={0.7}
      >
        <View style={styles.triggerContent}>
          <Text
            style={[styles.triggerValue, { color: theme.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {currentOption ? t(currentOption.labelKey) : t('autolock.select_timeout')}
          </Text>
          <Ionicons
            name="chevron-down-outline"
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
                {t('autolock.title')}
              </Text>
              <Text
                style={[styles.modalSubtitle, { color: theme.textSecondary }]}
              >
                {t('autolock.subtitle')}
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
                    <Ionicons
                      name={option.icon as any}
                      size={24}
                      color={getSecurityLevelColor(option.securityLevel)}
                    />
                    <View style={styles.optionTextContainer}>
                      <Text style={[styles.optionTitle, { color: theme.text }]}>
                        {t(option.labelKey)}
                      </Text>
                      <Text
                        style={[
                          styles.optionDescription,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {t(option.descriptionKey)}
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
                          {getSecurityLevelLabel(option.securityLevel, t)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {currentValue === option.value && (
                    <Ionicons
                      name="checkmark-circle-outline"
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
                <Ionicons name="finger-print" size={16} color={theme.primary} />
                <Text
                  style={[styles.footerText, { color: theme.textSecondary }]}
                >
                  {t('autolock.footer_trigger')}
                </Text>
              </View>
              <View style={styles.footerItem}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={16}
                  color={theme.primary}
                />
                <Text
                  style={[styles.footerText, { color: theme.textSecondary }]}
                >
                  {t('autolock.footer_biometric')}
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
    // No border, no background - clean like a Switch
  },
  disabled: {
    opacity: 0.6,
  },
  triggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  triggerValue: {
    fontSize: 16,
    fontWeight: '500',
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
