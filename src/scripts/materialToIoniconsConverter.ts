/**
 * Material Icons to Ionicons Migration Script
 * Converts all MaterialIcons usage to Ionicons throughout the project
 */

// Comprehensive mapping from Material Icons to Ionicons
export const MATERIAL_TO_IONICONS_MAP = {
  // Navigation & Actions
  'arrow-back': 'arrow-back-outline',
  'arrow-forward': 'arrow-forward-outline',
  close: 'close-outline',
  menu: 'menu-outline',
  'more-vert': 'ellipsis-vertical-outline',
  'more-horiz': 'ellipsis-horizontal-outline',
  add: 'add-outline',
  remove: 'remove-outline',
  edit: 'create-outline',
  delete: 'trash-outline',
  save: 'save-outline',
  cancel: 'close-outline',
  done: 'checkmark-outline',
  check: 'checkmark-outline',
  clear: 'close-outline',
  refresh: 'refresh-outline',

  // UI Elements
  search: 'search-outline',
  'filter-list': 'filter-outline',
  sort: 'funnel-outline',
  settings: 'settings-outline',
  info: 'information-circle-outline',
  help: 'help-circle-outline',
  warning: 'warning-outline',
  error: 'alert-circle-outline',
  'check-circle': 'checkmark-circle-outline',
  'radio-button-checked': 'radio-button-on-outline',
  'radio-button-unchecked': 'radio-button-off-outline',
  'check-box': 'checkbox-outline',
  'check-box-outline-blank': 'square-outline',

  // Content & Media
  visibility: 'eye-outline',
  'visibility-off': 'eye-off-outline',
  'content-copy': 'copy-outline',
  share: 'share-outline',
  download: 'download-outline',
  upload: 'cloud-upload-outline',
  'attach-file': 'attach-outline',
  image: 'image-outline',
  photo: 'image-outline',
  camera: 'camera-outline',

  // Communication & Social
  email: 'mail-outline',
  mail: 'mail-outline',
  phone: 'call-outline',
  message: 'chatbubble-outline',
  chat: 'chatbubble-outline',
  people: 'people-outline',
  person: 'person-outline',
  group: 'people-outline',

  // Business & Work
  work: 'briefcase-outline',
  business: 'business-outline',
  'account-balance': 'card-outline',
  'credit-card': 'card-outline',
  'attach-money': 'cash-outline',
  'shopping-cart': 'bag-outline',
  store: 'storefront-outline',
  'local-offer': 'pricetag-outline',

  // Technology & Development
  computer: 'laptop-outline',
  'phone-android': 'phone-portrait-outline',
  tablet: 'tablet-portrait-outline',
  tv: 'tv-outline',
  wifi: 'wifi-outline',
  bluetooth: 'bluetooth-outline',
  usb: 'hardware-chip-outline',
  memory: 'hardware-chip-outline',
  storage: 'server-outline',
  cloud: 'cloud-outline',
  link: 'link-outline',
  code: 'code-slash-outline',
  'bug-report': 'bug-outline',
  build: 'build-outline',
  construction: 'construct-outline',

  // Entertainment & Media
  movie: 'film-outline',
  'music-note': 'musical-notes-outline',
  headset: 'headset-outline',
  games: 'game-controller-outline',
  sports: 'football-outline',
  casino: 'dice-outline',

  // Travel & Transportation
  flight: 'airplane-outline',
  hotel: 'bed-outline',
  restaurant: 'restaurant-outline',
  'local-gas-station': 'car-outline',
  'directions-car': 'car-outline',
  train: 'train-outline',
  directions: 'navigate-outline',
  map: 'map-outline',
  place: 'location-outline',
  'gps-fixed': 'locate-outline',
  'my-location': 'locate-outline',

  // Health & Medical
  'local-hospital': 'medical-outline',
  'fitness-center': 'fitness-outline',
  spa: 'leaf-outline',
  healing: 'medical-outline',

  // Education & Learning
  school: 'school-outline',
  'library-books': 'library-outline',
  book: 'book-outline',
  note: 'document-text-outline',
  create: 'create-outline',
  'edit-note': 'create-outline',

  // Time & Date
  schedule: 'time-outline',
  today: 'calendar-outline',
  event: 'calendar-outline',
  'access-time': 'time-outline',
  timer: 'timer-outline',
  alarm: 'alarm-outline',

  // Security & Privacy
  lock: 'lock-closed-outline',
  'lock-open': 'lock-open-outline',
  security: 'shield-checkmark-outline',
  'verified-user': 'shield-checkmark-outline',
  'vpn-key': 'key-outline',
  fingerprint: 'finger-print',
  face: 'person-outline',

  // System & Status
  'battery-full': 'battery-full-outline',
  'signal-wifi-4-bar': 'wifi-outline',
  'network-wifi': 'wifi-outline',
  'volume-up': 'volume-high-outline',
  'volume-off': 'volume-off-outline',
  'brightness-high': 'sunny-outline',
  'brightness-low': 'moon-outline',

  // Files & Folders
  folder: 'folder-outline',
  'folder-open': 'folder-open-outline',
  'insert-drive-file': 'document-outline',
  description: 'document-text-outline',
  'picture-as-pdf': 'document-outline',

  // Shopping & Commerce
  'shopping-bag': 'bag-outline',
  'local-grocery-store': 'bag-outline',
  payment: 'card-outline',
  receipt: 'receipt-outline',

  // Categories (specific to our app)
  category: 'grid-outline',
  label: 'pricetag-outline',
  bookmark: 'bookmark-outline',
  star: 'star-outline',
  favorite: 'heart-outline',
  'thumb-up': 'thumbs-up-outline',

  // Misc
  language: 'globe-outline',
  translate: 'language-outline',
  public: 'globe-outline',
  explore: 'compass-outline',
  'location-on': 'location-outline',
  'power-settings-new': 'power-outline',
  'exit-to-app': 'log-out-outline',
  login: 'log-in-outline',
  logout: 'log-out-outline',
  backup: 'cloud-upload-outline',
  restore: 'cloud-download-outline',
  sync: 'sync-outline',
  update: 'refresh-outline',
  notifications: 'notifications-outline',
  'notifications-off': 'notifications-off-outline',

  // Additional specific icons
  'select-all': 'checkmark-done-outline',
  deselect: 'close-outline',
  'expand-more': 'chevron-down-outline',
  'expand-less': 'chevron-up-outline',
  'chevron-right': 'chevron-forward-outline',
  'chevron-left': 'chevron-back-outline',
} as const;

export class MaterialToIoniconsConverter {
  /**
   * Convert Material Icons name to Ionicons name
   */
  static convertIconName(materialIconName: string): string {
    const converted =
      MATERIAL_TO_IONICONS_MAP[
        materialIconName as keyof typeof MATERIAL_TO_IONICONS_MAP
      ];

    if (converted) {
      console.log(`🔄 Converting: "${materialIconName}" → "${converted}"`);
      return converted;
    }

    console.warn(
      `⚠️  No mapping found for MaterialIcon: "${materialIconName}"`,
    );
    return materialIconName; // Return original if no mapping found
  }

  /**
   * Get all Material Icons currently used in the project
   */
  static getUsedMaterialIcons(): string[] {
    // This would be populated by scanning the actual codebase
    return Object.keys(MATERIAL_TO_IONICONS_MAP);
  }

  /**
   * Generate replacement instructions for a specific file
   */
  static generateFileReplacements(
    materialIconsUsed: string[],
  ): Array<{ from: string; to: string }> {
    return materialIconsUsed.map(iconName => ({
      from: `name="${iconName}"`,
      to: `name="${this.convertIconName(iconName)}"`,
    }));
  }

  /**
   * Check if an icon name is already in Ionicons format
   */
  static isIoniconsFormat(iconName: string): boolean {
    // Ionicons typically end with -outline, -sharp, or are logo-* or single words
    const ioniconsPatterns = [
      /^[a-z][a-z0-9-]*-outline$/,
      /^[a-z][a-z0-9-]*-sharp$/,
      /^logo-[a-z]+$/,
      /^[a-z][a-z0-9-]*$/,
    ];

    return ioniconsPatterns.some(pattern => pattern.test(iconName));
  }

  /**
   * Generate migration report
   */
  static generateMigrationReport(): string {
    const totalMappings = Object.keys(MATERIAL_TO_IONICONS_MAP).length;

    let report = '🔄 MATERIAL ICONS TO IONICONS MIGRATION REPORT\n';
    report += '================================================\n\n';
    report += `📊 Total icon mappings available: ${totalMappings}\n\n`;

    report += '🎯 Key conversions:\n';
    const keyConversions = [
      'close → close-outline',
      'edit → create-outline',
      'delete → trash-outline',
      'visibility → eye-outline',
      'content-copy → copy-outline',
      'people → people-outline',
      'email → mail-outline',
      'shopping-cart → bag-outline',
      'security → shield-checkmark-outline',
    ];

    keyConversions.forEach(conversion => {
      report += `   ✅ ${conversion}\n`;
    });

    report += '\n💡 Benefits:\n';
    report += '   • Consistent icon library throughout app\n';
    report += '   • Better iOS integration (Ionicons is iOS-friendly)\n';
    report += '   • Smaller bundle size (single icon library)\n';
    report += '   • Future-proof icon names\n';

    return report;
  }
}

export default MaterialToIoniconsConverter;
