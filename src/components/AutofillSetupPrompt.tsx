/**
 * AutofillSetupPrompt Component
 *
 * Prompts user to enable autofill on first app launch after login.
 * Can be dismissed or accepted to navigate to AutofillManagement screen.
 *
 * @author PasswordEpic Team
 * @since Week 9 - Phase 4
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

interface AutofillSetupPromptProps {
  visible: boolean;
  onEnable: () => void;
  onDismiss: () => void;
}

export const AutofillSetupPrompt: React.FC<AutofillSetupPromptProps> = ({
  visible,
  onEnable,
  onDismiss,
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      onEnable();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View
        style={[styles.container, styles.modalBackdrop]}
      >
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          {/* Header with Close Button */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              {t('autofill_setup.title')}
            </Text>
            <TouchableOpacity
              onPress={onDismiss}
              style={styles.closeButton}
              disabled={isLoading}
            >
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Icon */}
            <View style={styles.iconContainer}>
              <View
                style={[
                  styles.iconBackground,
                  { backgroundColor: theme.primary + '20' },
                ]}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={48}
                  color={theme.primary}
                />
              </View>
            </View>

            {/* Subtitle */}
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {t('autofill_setup.subtitle')}
            </Text>

            {/* Benefits */}
            <View style={styles.benefitsContainer}>
              <View style={styles.benefitItem}>
                <View
                  style={[
                    styles.checkMark,
                    { backgroundColor: theme.success + '20' },
                  ]}
                >
                  <Ionicons name="checkmark" size={16} color={theme.success} />
                </View>
                <View style={styles.benefitText}>
                  <Text style={[styles.benefitTitle, { color: theme.text }]}>
                    {t('autofill_setup.benefit_autofill_title')}
                  </Text>
                  <Text
                    style={[
                      styles.benefitDescription,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {t('autofill_setup.benefit_autofill_desc')}
                  </Text>
                </View>
              </View>

              <View style={styles.benefitItem}>
                <View
                  style={[
                    styles.checkMark,
                    { backgroundColor: theme.success + '20' },
                  ]}
                >
                  <Ionicons name="checkmark" size={16} color={theme.success} />
                </View>
                <View style={styles.benefitText}>
                  <Text style={[styles.benefitTitle, { color: theme.text }]}>
                    {t('autofill_setup.benefit_secure_title')}
                  </Text>
                  <Text
                    style={[
                      styles.benefitDescription,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {t('autofill_setup.benefit_secure_desc')}
                  </Text>
                </View>
              </View>

              <View style={styles.benefitItem}>
                <View
                  style={[
                    styles.checkMark,
                    { backgroundColor: theme.success + '20' },
                  ]}
                >
                  <Ionicons name="checkmark" size={16} color={theme.success} />
                </View>
                <View style={styles.benefitText}>
                  <Text style={[styles.benefitTitle, { color: theme.text }]}>
                    {t('autofill_setup.benefit_time_title')}
                  </Text>
                  <Text
                    style={[
                      styles.benefitDescription,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {t('autofill_setup.benefit_time_desc')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Info Section */}
            <View
              style={[
                styles.infoSection,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Ionicons
                name="information-circle"
                size={20}
                color={theme.primary}
                style={styles.infoIcon}
              />
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                {t('autofill_setup.info_text')}
              </Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              onPress={onDismiss}
              disabled={isLoading}
            >
              <Text
                style={[styles.secondaryButtonText, { color: theme.primary }]}
              >
                {t('autofill_setup.later')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                {
                  backgroundColor: isLoading
                    ? theme.textSecondary
                    : theme.primary,
                },
              ]}
              onPress={handleEnable}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                  style={styles.loadingIcon}
                />
              ) : (
                <Ionicons
                  name="checkmark"
                  size={18}
                  color="#FFFFFF"
                  style={styles.primaryButtonIcon}
                />
              )}
              <Text style={styles.primaryButtonText}>
                {isLoading
                  ? t('autofill_setup.enabling')
                  : t('autofill_setup.enable_button')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  benefitsContainer: {
    marginBottom: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  checkMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  infoSection: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoIcon: {
    marginRight: 8,
  },
  infoText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonIcon: {
    marginRight: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 0.8,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingIcon: {
    marginRight: 8,
  },
});

export default AutofillSetupPrompt;
