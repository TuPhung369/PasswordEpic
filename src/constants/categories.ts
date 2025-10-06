import { PasswordCategoryExtended } from '../types/password';

// Default category icons (using Ionicons names)
export const CATEGORY_ICONS = {
  // Social & Communication
  social: 'people',
  communication: 'chat',
  messaging: 'message',

  // Work & Business
  work: 'people',
  business: 'movie',
  professional: 'person',

  // Financial
  banking: 'account-balance',
  finance: 'attach-money',
  investment: 'trending-up',
  cryptocurrency: 'monetization-on',

  // Entertainment
  entertainment: 'movie',
  gaming: 'games',
  streaming: 'tv',
  music: 'music-note',

  // Shopping & Commerce
  shopping: 'shopping-cart',
  ecommerce: 'store',
  retail: 'local-offer',

  // Education & Learning
  education: 'school',
  learning: 'library-books',
  research: 'search',

  // Health & Medical
  health: 'local-hospital',
  fitness: 'fitness-center',
  wellness: 'favorite',

  // Travel & Transportation
  travel: 'flight',
  transportation: 'directions-car',
  hotel: 'hotel',

  // Technology & Development
  development: 'code',
  technology: 'computer',
  cloud: 'cloud',
  server: 'storage',

  // Utilities & Services
  utilities: 'build',
  services: 'settings',
  subscription: 'event',

  // Personal
  personal: 'person',
  family: 'home',
  hobby: 'palette',

  // Security & Privacy
  security: 'security',
  privacy: 'visibility-off',
  vpn: 'vpn-key',

  // Default
  default: 'folder',
  other: 'more-horiz',
} as const;

// Default category colors
export const CATEGORY_COLORS = {
  // Blue shades
  blue: '#007AFF',
  lightBlue: '#5AC8FA',
  darkBlue: '#0051D5',

  // Green shades
  green: '#34C759',
  lightGreen: '#30D158',
  darkGreen: '#248A3D',

  // Red shades
  red: '#FF3B30',
  lightRed: '#FF453A',
  darkRed: '#D70015',

  // Orange shades
  orange: '#FF9500',
  lightOrange: '#FF9F0A',
  darkOrange: '#C93400',

  // Purple shades
  purple: '#AF52DE',
  lightPurple: '#BF5AF2',
  darkPurple: '#8E2DE2',

  // Pink shades
  pink: '#FF2D92',
  lightPink: '#FF2D92',
  darkPink: '#D70060',

  // Teal shades
  teal: '#32D74B',
  lightTeal: '#64D2FF',
  darkTeal: '#00C7BE',

  // Gray shades
  gray: '#8E8E93',
  lightGray: '#AEAEB2',
  darkGray: '#636366',

  // Yellow shades
  yellow: '#FFCC00',
  lightYellow: '#FFD60A',
  darkYellow: '#FF9F00',

  // Brown shades
  brown: '#A2845E',
  lightBrown: '#AC8E68',
  darkBrown: '#8D7653',
} as const;

// Predefined categories with comprehensive setup
export const DEFAULT_CATEGORIES: Omit<
  PasswordCategoryExtended,
  'createdAt' | 'entryCount' | 'lastUsed'
>[] = [
  // Social & Communication (4 categories)
  {
    id: 'social',
    name: 'Social Media',
    icon: CATEGORY_ICONS.social,
    color: CATEGORY_COLORS.blue,
    description: 'Facebook, Twitter, Instagram, LinkedIn',
    isCustom: false,
    sortOrder: 1,
  },
  {
    id: 'communication',
    name: 'Communication',
    icon: CATEGORY_ICONS.communication,
    color: CATEGORY_COLORS.lightBlue,
    description: 'Email, messaging apps, forums',
    isCustom: false,
    sortOrder: 2,
  },
  {
    id: 'messaging',
    name: 'Messaging',
    icon: CATEGORY_ICONS.messaging,
    color: CATEGORY_COLORS.teal,
    description: 'WhatsApp, Telegram, Discord, Slack',
    isCustom: false,
    sortOrder: 3,
  },

  // Work & Business (3 categories)
  {
    id: 'work',
    name: 'Work',
    icon: CATEGORY_ICONS.work,
    color: CATEGORY_COLORS.darkBlue,
    description: 'Office applications, work tools',
    isCustom: false,
    sortOrder: 4,
  },
  {
    id: 'business',
    name: 'Business',
    icon: CATEGORY_ICONS.business,
    color: CATEGORY_COLORS.purple,
    description: 'Business services, CRM, analytics',
    isCustom: false,
    sortOrder: 5,
  },

  // Financial (4 categories)
  {
    id: 'banking',
    name: 'Banking',
    icon: CATEGORY_ICONS.banking,
    color: CATEGORY_COLORS.green,
    description: 'Bank accounts, credit cards, loans',
    isCustom: false,
    sortOrder: 6,
  },
  {
    id: 'finance',
    name: 'Finance',
    icon: CATEGORY_ICONS.finance,
    color: CATEGORY_COLORS.lightGreen,
    description: 'Investment platforms, budgeting apps',
    isCustom: false,
    sortOrder: 7,
  },
  {
    id: 'cryptocurrency',
    name: 'Cryptocurrency',
    icon: CATEGORY_ICONS.cryptocurrency,
    color: CATEGORY_COLORS.orange,
    description: 'Crypto exchanges, wallets, DeFi',
    isCustom: false,
    sortOrder: 8,
  },

  // Entertainment (4 categories)
  {
    id: 'entertainment',
    name: 'Entertainment',
    icon: CATEGORY_ICONS.entertainment,
    color: CATEGORY_COLORS.red,
    description: 'Streaming, movies, TV shows',
    isCustom: false,
    sortOrder: 9,
  },
  {
    id: 'gaming',
    name: 'Gaming',
    icon: CATEGORY_ICONS.gaming,
    color: CATEGORY_COLORS.lightRed,
    description: 'Game platforms, online games',
    isCustom: false,
    sortOrder: 10,
  },
  {
    id: 'streaming',
    name: 'Streaming',
    icon: CATEGORY_ICONS.streaming,
    color: CATEGORY_COLORS.pink,
    description: 'Netflix, YouTube, Spotify, Twitch',
    isCustom: false,
    sortOrder: 11,
  },

  // Shopping & Commerce (2 categories)
  {
    id: 'shopping',
    name: 'Shopping',
    icon: CATEGORY_ICONS.shopping,
    color: CATEGORY_COLORS.lightPink,
    description: 'Online stores, marketplaces',
    isCustom: false,
    sortOrder: 12,
  },
  {
    id: 'ecommerce',
    name: 'E-commerce',
    icon: CATEGORY_ICONS.ecommerce,
    color: CATEGORY_COLORS.yellow,
    description: 'Amazon, eBay, Shopify stores',
    isCustom: false,
    sortOrder: 13,
  },

  // Education & Learning (2 categories)
  {
    id: 'education',
    name: 'Education',
    icon: CATEGORY_ICONS.education,
    color: CATEGORY_COLORS.lightYellow,
    description: 'Online courses, schools, universities',
    isCustom: false,
    sortOrder: 14,
  },

  // Health & Medical (2 categories)
  {
    id: 'health',
    name: 'Health',
    icon: CATEGORY_ICONS.health,
    color: CATEGORY_COLORS.darkGreen,
    description: 'Medical portals, health apps',
    isCustom: false,
    sortOrder: 15,
  },

  // Travel & Transportation (2 categories)
  {
    id: 'travel',
    name: 'Travel',
    icon: CATEGORY_ICONS.travel,
    color: CATEGORY_COLORS.lightTeal,
    description: 'Airlines, hotels, booking sites',
    isCustom: false,
    sortOrder: 16,
  },

  // Technology & Development (3 categories)
  {
    id: 'development',
    name: 'Development',
    icon: CATEGORY_ICONS.development,
    color: CATEGORY_COLORS.darkPurple,
    description: 'GitHub, DevTools, APIs, IDEs',
    isCustom: false,
    sortOrder: 17,
  },
  {
    id: 'cloud',
    name: 'Cloud Services',
    icon: CATEGORY_ICONS.cloud,
    color: CATEGORY_COLORS.lightPurple,
    description: 'AWS, Google Cloud, Azure, Dropbox',
    isCustom: false,
    sortOrder: 18,
  },

  // Utilities & Services (2 categories)
  {
    id: 'utilities',
    name: 'Utilities',
    icon: CATEGORY_ICONS.utilities,
    color: CATEGORY_COLORS.brown,
    description: 'Productivity tools, utilities',
    isCustom: false,
    sortOrder: 19,
  },
  {
    id: 'subscription',
    name: 'Subscriptions',
    icon: CATEGORY_ICONS.subscription,
    color: CATEGORY_COLORS.lightBrown,
    description: 'Monthly services, memberships',
    isCustom: false,
    sortOrder: 20,
  },

  // Personal (2 categories)
  {
    id: 'personal',
    name: 'Personal',
    icon: CATEGORY_ICONS.personal,
    color: CATEGORY_COLORS.gray,
    description: 'Personal accounts, profiles',
    isCustom: false,
    sortOrder: 21,
  },

  // Security & Privacy (2 categories)
  {
    id: 'security',
    name: 'Security',
    icon: CATEGORY_ICONS.security,
    color: CATEGORY_COLORS.darkRed,
    description: 'Security tools, VPNs, 2FA apps',
    isCustom: false,
    sortOrder: 22,
  },

  // Default/Other
  {
    id: 'other',
    name: 'Other',
    icon: CATEGORY_ICONS.other,
    color: CATEGORY_COLORS.darkGray,
    description: 'Uncategorized entries',
    isCustom: false,
    sortOrder: 999,
  },
];

// Helper functions for category management
export const getCategoryById = (
  id: string,
): PasswordCategoryExtended | undefined => {
  return DEFAULT_CATEGORIES.find(
    cat => cat.id === id,
  ) as PasswordCategoryExtended;
};

export const getCategoryByName = (
  name: string,
): PasswordCategoryExtended | undefined => {
  return DEFAULT_CATEGORIES.find(
    cat => cat.name.toLowerCase() === name.toLowerCase(),
  ) as PasswordCategoryExtended;
};

export const getAvailableIcons = (): string[] => {
  return Object.values(CATEGORY_ICONS);
};

export const getAvailableColors = (): string[] => {
  return Object.values(CATEGORY_COLORS);
};

export const createCustomCategory = (
  name: string,
  icon: string = CATEGORY_ICONS.default,
  color: string = CATEGORY_COLORS.blue,
  description?: string,
): Omit<
  PasswordCategoryExtended,
  'id' | 'createdAt' | 'entryCount' | 'lastUsed'
> => {
  return {
    name,
    icon,
    color,
    description,
    isCustom: true,
    sortOrder: DEFAULT_CATEGORIES.length + 1,
  };
};

// Category validation
export const validateCategoryIcon = (icon: string): boolean => {
  return Object.values(CATEGORY_ICONS).includes(icon as any);
};

export const validateCategoryColor = (color: string): boolean => {
  return (
    Object.values(CATEGORY_COLORS).includes(color as any) ||
    /^#[0-9A-Fa-f]{6}$/.test(color)
  );
};

// Category statistics helpers
export const getCategoryStats = (categories: PasswordCategoryExtended[]) => {
  return {
    total: categories.length,
    custom: categories.filter(cat => cat.isCustom).length,
    default: categories.filter(cat => !cat.isCustom).length,
    mostUsed: categories.reduce((prev, current) =>
      current.entryCount > prev.entryCount ? current : prev,
    ),
    leastUsed: categories.reduce((prev, current) =>
      current.entryCount < prev.entryCount ? current : prev,
    ),
  };
};

export type CategoryIcon = keyof typeof CATEGORY_ICONS;
export type CategoryColor = keyof typeof CATEGORY_COLORS;
