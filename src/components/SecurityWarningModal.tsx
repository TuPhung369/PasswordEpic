/**
 * Security Warning Modal
 *
 * Displays security warnings and threats to the user
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { SecurityThreat } from '../services/securityService';

interface SecurityWarningModalProps {
  visible: boolean;
  threats: SecurityThreat[];
  onClose: () => void;
  onContinueAnyway?: () => void;
  allowContinue?: boolean;
}

const SecurityWarningModal: React.FC<SecurityWarningModalProps> = ({
  visible,
  threats,
  onClose,
  onContinueAnyway,
  allowContinue = false,
}) => {
  const criticalThreats = threats.filter(t => t.severity === 'critical');
  const highThreats = threats.filter(t => t.severity === 'high');
  const otherThreats = threats.filter(
    t => t.severity !== 'critical' && t.severity !== 'high',
  );

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#DC2626';
      case 'high':
        return '#EA580C';
      case 'medium':
        return '#F59E0B';
      case 'low':
        return '#10B981';
      default:
        return '#6B7280';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '🚨';
      case 'high':
        return '⚠️';
      case 'medium':
        return '⚡';
      case 'low':
        return 'ℹ️';
      default:
        return '•';
    }
  };

  const renderThreat = (threat: SecurityThreat, index: number) => (
    <View key={index} style={styles.threatCard}>
      <View style={styles.threatHeader}>
        <Text style={styles.threatIcon}>
          {getSeverityIcon(threat.severity)}
        </Text>
        <View style={styles.threatHeaderText}>
          <Text style={styles.threatType}>
            {threat.type.replace(/_/g, ' ').toUpperCase()}
          </Text>
          <View
            style={[
              styles.severityBadge,
              { backgroundColor: getSeverityColor(threat.severity) },
            ]}
          >
            <Text style={styles.severityText}>
              {threat.severity.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.threatDescription}>{threat.description}</Text>

      <View style={styles.recommendationBox}>
        <Text style={styles.recommendationLabel}>Recommendation:</Text>
        <Text style={styles.recommendationText}>{threat.recommendation}</Text>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>🔒 Security Warning</Text>
            <Text style={styles.subtitle}>
              {threats.length} security{' '}
              {threats.length === 1 ? 'threat' : 'threats'} detected
            </Text>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {criticalThreats.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Critical Threats</Text>
                {criticalThreats.map(renderThreat)}
              </View>
            )}

            {highThreats.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>High-Risk Threats</Text>
                {highThreats.map(renderThreat)}
              </View>
            )}

            {otherThreats.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Other Threats</Text>
                {otherThreats.map(renderThreat)}
              </View>
            )}

            {criticalThreats.length > 0 && (
              <View style={styles.warningBox}>
                <Text style={styles.warningIcon}>⚠️</Text>
                <Text style={styles.warningText}>
                  Critical security threats detected. Using PasswordEpic on this
                  device may compromise your password security. We strongly
                  recommend addressing these issues before continuing.
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {allowContinue && onContinueAnyway && (
              <TouchableOpacity
                style={[styles.button, styles.continueButton]}
                onPress={onContinueAnyway}
              >
                <Text style={styles.continueButtonText}>Continue Anyway</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.button, styles.closeButton]}
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>
                {allowContinue ? 'Close App' : 'OK'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F3F4F6',
    marginBottom: 12,
  },
  threatCard: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  threatHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  threatIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  threatHeaderText: {
    flex: 1,
  },
  threatType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F3F4F6',
    marginBottom: 6,
  },
  severityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  severityText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  threatDescription: {
    fontSize: 14,
    color: '#D1D5DB',
    lineHeight: 20,
    marginBottom: 12,
  },
  recommendationBox: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  recommendationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
    marginBottom: 4,
  },
  recommendationText: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 18,
  },
  warningBox: {
    backgroundColor: '#7C2D12',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  warningIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#FED7AA',
    lineHeight: 18,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButton: {
    backgroundColor: '#374151',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  closeButton: {
    backgroundColor: '#3B82F6',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default SecurityWarningModal;
