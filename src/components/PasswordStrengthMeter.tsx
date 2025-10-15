import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { calculatePasswordStrength } from '../utils/passwordUtils';

export interface PasswordStrength {
  score: number; // 0-4 (matching PasswordStrengthResult)
  label: string;
  color: string;
  feedback: string[];
  crackTime: string;
}

interface PasswordStrengthMeterProps {
  password: string;
  showDetails?: boolean;
  compact?: boolean;
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  password,
  showDetails = false,
  compact = false,
}) => {
  const { theme } = useTheme();
  const strength = calculatePasswordStrength(password);

  const getStrengthIcon = () => {
    if (strength.score <= 1) return 'shield-outline';
    if (strength.score <= 2) return 'warning-outline';
    if (strength.score <= 3) return 'shield-checkmark-outline';
    if (strength.score <= 4) return 'shield-outline';
    return 'ribbon-outline';
  };

  const renderStrengthBars = () => {
    return (
      <View style={styles.strengthBars}>
        {[1, 2, 3, 4].map(level => (
          <View
            key={level}
            style={[
              styles.strengthBar,
              {
                backgroundColor:
                  level <= strength.score ? strength.color : theme.border,
              },
            ]}
          />
        ))}
      </View>
    );
  };

  const renderCompactView = () => (
    <View style={styles.compactContainer}>
      <View style={styles.compactHeader}>
        <Ionicons name={getStrengthIcon()} size={16} color={strength.color} />
        <Text style={[styles.compactLabel, { color: strength.color }]}>
          {strength.label}
        </Text>
      </View>
      {renderStrengthBars()}
    </View>
  );

  const renderDetailedView = () => (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.strengthInfo}>
          <Ionicons name={getStrengthIcon()} size={24} color={strength.color} />
          <View style={styles.strengthText}>
            <Text style={[styles.strengthLabel, { color: strength.color }]}>
              {strength.label}
            </Text>
            <Text style={[styles.entropyText, { color: theme.textSecondary }]}>
              Security Analysis
            </Text>
          </View>
        </View>
        <Text style={[styles.timeEstimate, { color: theme.textSecondary }]}>
          {strength.crackTime}
        </Text>
      </View>

      {renderStrengthBars()}

      {showDetails && (
        <View style={styles.details}>
          {strength.feedback.length > 0 && (
            <View style={styles.feedbackSection}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Security Analysis
              </Text>
              {strength.feedback.map((item, index) => (
                <View key={index} style={styles.feedbackItem}>
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color={theme.primary}
                  />
                  <Text style={[styles.feedbackText, { color: theme.text }]}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.suggestionsSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Crack Time Estimate
            </Text>
            <View style={styles.suggestionItem}>
              <Ionicons name="time-outline" size={16} color={theme.primary} />
              <Text style={[styles.suggestionText, { color: theme.text }]}>
                {strength.crackTime} to crack this password
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );

  if (!password) {
    return null;
  }

  return compact ? renderCompactView() : renderDetailedView();
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 0.5,
    padding: 16,
    marginVertical: 8,
  },
  compactContainer: {
    gap: 8,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  strengthInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  strengthText: {
    gap: 2,
  },
  strengthLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  entropyText: {
    fontSize: 12,
  },
  timeEstimate: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'right',
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 16,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  details: {
    gap: 16,
  },
  feedbackSection: {
    gap: 8,
  },
  suggestionsSection: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  feedbackItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 2,
  },
  feedbackText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 2,
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
