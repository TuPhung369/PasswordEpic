/**
 * Automated Material to Ionicons Conversion Script
 * Script để convert tự động tất cả MaterialIcons thành Ionicons trong project
 */

import { MATERIAL_TO_IONICONS_MAP } from './materialToIoniconsConverter';

export interface FileConversion {
  filePath: string;
  conversions: Array<{
    from: string;
    to: string;
    line?: number;
  }>;
  success: boolean;
  errors: string[];
}

export class AutoConversionScript {
  /**
   * List các files cần convert và mappings specific cho từng file
   */
  static getFilesToConvert(): Array<{
    path: string;
    priority: 'high' | 'medium' | 'low';
  }> {
    return [
      // High priority - core screens
      { path: 'src/screens/main/PasswordsScreen.tsx', priority: 'high' },
      { path: 'src/screens/main/AddPasswordScreen.tsx', priority: 'high' },
      { path: 'src/screens/main/EditPasswordScreen.tsx', priority: 'high' },

      // Medium priority - components
      { path: 'src/components/SortFilterSheet.tsx', priority: 'medium' },
      { path: 'src/components/PasswordForm.tsx', priority: 'medium' },
      { path: 'src/components/BackupRestoreModal.tsx', priority: 'medium' },
      { path: 'src/components/Toast.tsx', priority: 'medium' },
      { path: 'src/components/ThemeModal.tsx', priority: 'medium' },

      // Low priority - other files
      { path: 'src/navigation/MainNavigator.tsx', priority: 'low' },
      { path: 'src/screens/auth/MasterPasswordScreen.tsx', priority: 'low' },
      { path: 'src/screens/auth/BiometricSetupScreen.tsx', priority: 'low' },
    ];
  }

  /**
   * Generate replacements for a specific file type
   */
  static generateReplacements(): Array<{ find: string; replace: string }> {
    const replacements: Array<{ find: string; replace: string }> = [];

    // 1. Import statements
    replacements.push({
      find: "import MaterialIcons from 'react-native-vector-icons/MaterialIcons';",
      replace: "import Ionicons from 'react-native-vector-icons/Ionicons';",
    });

    replacements.push({
      find: "import Icon from 'react-native-vector-icons/MaterialIcons';",
      replace: "import Ionicons from 'react-native-vector-icons/Ionicons';",
    });

    // 2. Component name changes
    replacements.push({
      find: '<MaterialIcons',
      replace: '<Ionicons',
    });

    replacements.push({
      find: '</MaterialIcons>',
      replace: '</Ionicons>',
    });

    replacements.push({
      find: '<Icon',
      replace: '<Ionicons',
    });

    // 3. Common icon name replacements
    Object.entries(MATERIAL_TO_IONICONS_MAP).forEach(
      ([materialIcon, ionIcon]) => {
        replacements.push({
          find: `name="${materialIcon}"`,
          replace: `name="${ionIcon}"`,
        });
      },
    );

    return replacements;
  }

  /**
   * Generate conversion report for all files
   */
  static async generateConversionPlan(): Promise<string> {
    const files = this.getFilesToConvert();
    const replacements = this.generateReplacements();

    let report = '🔄 MATERIAL TO IONICONS CONVERSION PLAN\n';
    report += '=====================================\n\n';

    report += `📁 Files to convert: ${files.length}\n`;
    report += `🔄 Replacement rules: ${replacements.length}\n\n`;

    report += '📋 File Priority Order:\n';

    ['high', 'medium', 'low'].forEach(priority => {
      const priorityFiles = files.filter(f => f.priority === priority);
      if (priorityFiles.length > 0) {
        report += `\n${priority.toUpperCase()} PRIORITY (${
          priorityFiles.length
        } files):\n`;
        priorityFiles.forEach((file, index) => {
          report += `  ${index + 1}. ${file.path}\n`;
        });
      }
    });

    report += '\n🎯 Key Conversions:\n';
    const keyConversions = [
      'MaterialIcons → Ionicons (import)',
      'close → close-outline',
      'add → add-outline',
      'edit → create-outline',
      'delete → trash-outline',
      'visibility → eye-outline',
      'content-copy → copy-outline',
      'search → search-outline',
      'settings → settings-outline',
      'person → person-outline',
    ];

    keyConversions.forEach(conversion => {
      report += `   ✅ ${conversion}\n`;
    });

    report += '\n💡 Manual Review Needed:\n';
    report += '   • Icons not in mapping dictionary\n';
    report += '   • Dynamic icon names (variables)\n';
    report += '   • Custom icon components\n';
    report += '   • Third-party library icons\n';

    report += '\n🚀 Next Steps:\n';
    report += '   1. Run conversion on high priority files\n';
    report += '   2. Test app functionality\n';
    report += '   3. Convert medium priority files\n';
    report += '   4. Convert remaining files\n';
    report += '   5. Remove MaterialIcons dependency\n';

    return report;
  }

  /**
   * Validate converted files
   */
  static validateConversion(): Array<{ file: string; issues: string[] }> {
    const validationResults: Array<{ file: string; issues: string[] }> = [];

    // This would scan files for potential issues:
    // - Remaining MaterialIcons usage
    // - Invalid Ionicons names
    // - Missing imports

    return validationResults;
  }

  /**
   * Generate migration checklist
   */
  static getMigrationChecklist(): string[] {
    return [
      '✅ Update SettingsScreen.tsx (COMPLETED)',
      '🔄 Update PasswordsScreen.tsx',
      '🔄 Update AddPasswordScreen.tsx',
      '🔄 Update EditPasswordScreen.tsx',
      '🔄 Update SortFilterSheet.tsx (PARTIALLY DONE)',
      '🔄 Update PasswordEntry.tsx (COMPLETED)',
      '🔄 Update remaining components',
      '🔄 Test all screens work correctly',
      '🔄 Remove MaterialIcons from package.json',
      '🔄 Update documentation',
    ];
  }
}

export default AutoConversionScript;
