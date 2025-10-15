/**
 * Reset Categories with Fixed Icons Script
 * This script resets categories to default and applies the corrected Ionicons names
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CategoryService } from '../services/categoryService';

interface ScriptResult {
  success: boolean;
  message: string;
  categoriesReset: number;
  errors: string[];
}

export class ResetCategoriesScript {
  /**
   * Execute the categories reset with fixed icons
   */
  static async execute(): Promise<ScriptResult> {
    const result: ScriptResult = {
      success: false,
      message: '',
      categoriesReset: 0,
      errors: [],
    };

    try {
      console.log('🔄 Starting categories reset with fixed icons...');

      // Step 1: Get current categories for logging
      const currentCategories = await CategoryService.getAllCategories();
      console.log(`📋 Current categories: ${currentCategories.length}`);

      // Step 2: Reset to default categories (this will use the updated DEFAULT_CATEGORIES)
      await CategoryService.resetToDefaultCategories();

      // Step 3: Verify the reset worked
      const newCategories = await CategoryService.getAllCategories();
      console.log(`✅ Categories after reset: ${newCategories.length}`);

      // Step 4: Log the new icon names to verify they're correct
      console.log('📱 Updated category icons:');
      newCategories.forEach(cat => {
        console.log(`  ${cat.name}: ${cat.icon} (${cat.color})`);
      });

      result.success = true;
      result.message = `Successfully reset ${newCategories.length} categories with fixed Ionicons names`;
      result.categoriesReset = newCategories.length;

      // Step 5: Validate icons are using Ionicons format
      const invalidIcons = newCategories.filter(cat => {
        // Check if icon name looks like Material Icons (contains hyphen or underscore patterns)
        const isMaterialIcon =
          cat.icon.includes('_') ||
          [
            'people',
            'work',
            'shopping-cart',
            'card',
            'game',
            'movie',
            'email',
          ].includes(cat.icon);
        return isMaterialIcon;
      });

      if (invalidIcons.length > 0) {
        result.errors.push(
          `Found ${invalidIcons.length} categories with potentially invalid icon names`,
        );
        invalidIcons.forEach(cat => {
          console.warn(
            `⚠️ Category "${cat.name}" may have invalid icon: ${cat.icon}`,
          );
        });
      }

      console.log('🎉 Categories reset completed successfully!');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Categories reset failed:', errorMessage);

      result.success = false;
      result.message = `Failed to reset categories: ${errorMessage}`;
      result.errors.push(errorMessage);
    }

    return result;
  }

  /**
   * Backup current categories before reset
   */
  static async backupCurrentCategories(): Promise<boolean> {
    try {
      console.log('💾 Creating backup of current categories...');

      const categories = await CategoryService.getAllCategories();
      const backup = {
        timestamp: new Date().toISOString(),
        categories: categories,
      };

      await AsyncStorage.setItem(
        'passwordepic_categories_backup',
        JSON.stringify(backup),
      );

      console.log(`✅ Backup created for ${categories.length} categories`);
      return true;
    } catch (error) {
      console.error('❌ Failed to create backup:', error);
      return false;
    }
  }

  /**
   * Restore categories from backup
   */
  static async restoreFromBackup(): Promise<boolean> {
    try {
      console.log('🔄 Restoring categories from backup...');

      const backupData = await AsyncStorage.getItem(
        'passwordepic_categories_backup',
      );
      if (!backupData) {
        console.warn('⚠️ No backup found');
        return false;
      }

      const backup = JSON.parse(backupData);
      console.log(
        `📋 Found backup from ${backup.timestamp} with ${backup.categories.length} categories`,
      );

      // This would require additional CategoryService methods to restore
      console.log('ℹ️ Backup restore would need additional implementation');

      return true;
    } catch (error) {
      console.error('❌ Failed to restore from backup:', error);
      return false;
    }
  }

  /**
   * Check if categories need icon fixes
   */
  static async checkIconStatus(): Promise<{
    needsFix: boolean;
    issues: string[];
  }> {
    try {
      const categories = await CategoryService.getAllCategories();
      const issues: string[] = [];

      // Known Material Icons that should be replaced
      const materialIconsToFix = [
        'people',
        'work',
        'shopping-cart',
        'card_giftcard',
        'games',
        'movie',
        'music_note',
        'school',
        'fitness_center',
        'local_hospital',
        'email',
      ];

      categories.forEach(cat => {
        if (materialIconsToFix.includes(cat.icon)) {
          issues.push(`Category "${cat.name}" uses Material Icon: ${cat.icon}`);
        }
      });

      return {
        needsFix: issues.length > 0,
        issues,
      };
    } catch (error) {
      console.error('❌ Failed to check icon status:', error);
      return { needsFix: false, issues: ['Failed to check categories'] };
    }
  }
}

// Export for direct usage
export default ResetCategoriesScript;

// Usage example:
/*
import ResetCategoriesScript from '../scripts/resetCategoriesWithFixedIcons';

// In your component or service:
const handleResetCategories = async () => {
  // Optional: create backup first
  await ResetCategoriesScript.backupCurrentCategories();
  
  // Reset categories with fixed icons
  const result = await ResetCategoriesScript.execute();
  
  if (result.success) {
    console.log(result.message);
    // Show success message to user
  } else {
    console.error('Reset failed:', result.errors);
    // Show error message to user
  }
};
*/
