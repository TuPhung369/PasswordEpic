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
  '1password.com',
  '2fa.com',
  'acb.com.vn',
  'actia.fi',
  'agribank.com.vn',
  'alibaba.com',
  'aliexpress.com',
  'amazon.com',
  'asana.com',
  'authy.com',
  'aws.amazon.com',
  'azure.microsoft.com',
  'bauhaus.fi',
  'bidv.com.vn',
  'bitwarden.com',
  'bing.com',
  'bitbucket.org',
  'clasohlson.fi',
  'cloud.google.com',
  'com.passwordepic.mobile',
  'confluence.atlassian.net',
  'console.aws.amazon.com',
  'console.cloud.google.com',
  'danske.fi',
  'danskebank.fi',
  'dashlane.com',
  'dev.azure.com',
  'dev.to',
  'devops.azure.com',
  'discord.com',
  'disneyplus.com',
  'dna.fi',
  'docker.com',
  'docs.google.com',
  'dropbox.com',
  'duckduckgo.com',
  'ebay.com',
  'elisa.fi',
  'facebook.com',
  'fpt.com.vn',
  'gigantti.fi',
  'github.com',
  'github.io',
  'gitlab.com',
  'gmail.com',
  'golang.org',
  'google.com',
  'handelsbanken.fi',
  'hbomax.com',
  'hashnode.com',
  'hotmail.com',
  'hs.fi',
  'hulu.com',
  'icloud.com',
  'if.fi',
  'instagram.com',
  'is.fi',
  'jira.atlassian.net',
  'jimms.fi',
  'kela.fi',
  'kubernetes.io',
  'lastpass.com',
  'lazada.com',
  'lazada.vn',
  'linkedin.com',
  'mail.protonmail.com',
  'maven.apache.org',
  'medium.com',
  'meet.google.com',
  'messenger.com',
  'microsoft.com',
  'momo.vn',
  'mtv3.fi',
  'netflix.com',
  'nordea.fi',
  'npmjs.com',
  'notion.so',
  'office.com',
  'onedrive.live.com',
  'op.fi',
  'osuuspankki.fi',
  'outlook.com',
  'paypal.com',
  'peacock.com',
  'pinterest.com',
  'pops.fi',
  'portal.azure.com',
  'pohjola.fi',
  'primevideo.com',
  'protonmail.com',
  'pypi.org',
  'python.org',
  'reddit.com',
  'revolut.com',
  'ruoka.fi',
  'rust-lang.org',
  's-pankki.fi',
  'sampo.fi',
  'shopee.com',
  'shopee.vn',
  'shopify.com',
  'skype.com',
  'slack.com',
  'snapchat.com',
  'sonera.fi',
  'spotify.com',
  'stackoverflow.com',
  'stockmann.fi',
  'stripe.com',
  'stripe.dashboard.com',
  'suomi.fi',
  'tapiola.fi',
  'techcombank.com.vn',
  'telegram.org',
  'teams.microsoft.com',
  'telia.fi',
  'tiktok.com',
  'tiki.vn',
  'trello.com',
  'twitch.tv',
  'twitter.com',
  'vero.fi',
  'vietcombank.com.vn',
  'vietinbank.vn',
  'wikipedia.org',
  'wolt.com',
  'wise.com',
  'x.com',
  'yahoo.com',
  'yle.fi',
  'youtube.com',
  'zalo.me',
  'zoom.us',
  'sheets.google.com',
  'slides.google.com',
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
