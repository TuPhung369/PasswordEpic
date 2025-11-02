/**
 * Default Trusted Domains
 *
 * Commonly used domains from popular services and major companies
 * that users can quickly add to their trusted domains list.
 *
 * Categories:
 * - Development & Version Control
 * - Cloud Services & Storage
 * - Communication & Collaboration
 * - Productivity Tools
 * - Social Media
 * - Financial Services
 * - Shopping & E-commerce
 * - Entertainment
 * - Security & Privacy
 * - Email Services
 * - Developer Tools
 * - Other Popular Services
 */

export const DEFAULT_DOMAINS = [
  // ============ Development & Version Control ============
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'github.io',
  'dev.azure.com',

  // ============ Cloud Services & Storage ============
  'aws.amazon.com',
  'console.aws.amazon.com',
  'google.com',
  'cloud.google.com',
  'console.cloud.google.com',
  'microsoft.com',
  'azure.microsoft.com',
  'portal.azure.com',
  'dropbox.com',
  'onedrive.live.com',
  'icloud.com',

  // ============ Communication & Collaboration ============
  'slack.com',
  'discord.com',
  'teams.microsoft.com',
  'zoom.us',
  'meet.google.com',
  'messenger.com',
  'telegram.org',
  'skype.com',
  'linkedin.com',

  // ============ Productivity & Office ============
  'office.com',
  'docs.google.com',
  'sheets.google.com',
  'slides.google.com',
  'trello.com',
  'asana.com',
  'notion.so',
  'jira.atlassian.net',
  'confluence.atlassian.net',

  // ============ Social Media ============
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'reddit.com',
  'youtube.com',
  'twitch.tv',
  'pinterest.com',
  'snapchat.com',

  // ============ Financial Services ============
  'paypal.com',
  'stripe.com',
  'wise.com',
  'revolut.com',
  'stripe.dashboard.com',

  // ============ Shopping & E-commerce ============
  'amazon.com',
  'ebay.com',
  'alibaba.com',
  'aliexpress.com',
  'shopify.com',
  'shopee.com',
  'lazada.com',

  // ============ Entertainment & Streaming ============
  'netflix.com',
  'disneyplus.com',
  'primevideo.com',
  'hulu.com',
  'spotify.com',
  'hbomax.com',
  'peacock.com',

  // ============ Email Services ============
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'protonmail.com',
  'mail.protonmail.com',

  // ============ Search Engines ============
  'google.com',
  'bing.com',
  'duckduckgo.com',

  // ============ Developer & Tech Tools ============
  'stackoverflow.com',
  'npmjs.com',
  'pypi.org',
  'maven.apache.org',
  'docker.com',
  'kubernetes.io',
  'rust-lang.org',
  'golang.org',
  'python.org',

  // ============ Security & Verification ============
  'com.passwordepic.mobile',
  'facebook.com/login',
  'instagram.com/accounts/login',
  '2fa.com',
  'authy.com',
  'lastpass.com',
  'bitwarden.com',
  '1password.com',
  'dashlane.com',

  // ============ Popular Websites ============
  'wikipedia.org',
  'medium.com',
  'dev.to',
  'hashnode.com',
];

/**
 * Get popular domains by category
 * @param category - Category filter (optional)
 * @returns Array of domains
 */
export const getPopularDomainsByCategory = (): {
  [key: string]: string[];
} => {
  return {
    Development: ['github.com', 'gitlab.com', 'bitbucket.org', 'dev.azure.com'],
    'Cloud Services': [
      'aws.amazon.com',
      'cloud.google.com',
      'azure.microsoft.com',
      'dropbox.com',
    ],
    Communication: [
      'slack.com',
      'discord.com',
      'teams.microsoft.com',
      'zoom.us',
    ],
    Productivity: ['docs.google.com', 'office.com', 'trello.com', 'notion.so'],
    'Social Media': [
      'facebook.com',
      'instagram.com',
      'twitter.com',
      'linkedin.com',
    ],
    Shopping: ['amazon.com', 'ebay.com', 'aliexpress.com'],
    Entertainment: ['netflix.com', 'spotify.com', 'youtube.com', 'twitch.tv'],
    Financial: ['paypal.com', 'stripe.com', 'wise.com'],
    Email: ['gmail.com', 'outlook.com', 'protonmail.com', 'yahoo.com'],
  };
};

/**
 * Check if domain is in default list
 * @param domain - Domain to check
 * @returns True if domain is in default list
 */
export const isDefaultDomain = (domain: string): boolean => {
  return DEFAULT_DOMAINS.some(
    defaultDomain => defaultDomain.toLowerCase() === domain.toLowerCase(),
  );
};
