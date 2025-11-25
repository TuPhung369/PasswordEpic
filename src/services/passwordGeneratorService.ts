import { generateSecurePassword } from '../utils/passwordUtils';
import {
  PasswordGeneratorOptions,
  PasswordStrengthResult,
} from '../types/password';
import { calculatePasswordStrength } from '../utils/passwordUtils';
import {
  PRONOUNCEABLE_SYLLABLES,
  MEMORABLE_WORDS,
  MEMORABLE_ADJECTIVES,
  PASSPHRASE_WORDS,
  SOCIAL_PASSWORD_SYLLABLES,
} from '../constants/passwordWordLists';

export interface GenerationHistory {
  id: string;
  password: string;
  timestamp: Date;
  options: PasswordGeneratorOptions;
  strength: PasswordStrengthResult;
  isFavorite: boolean;
  templateUsed?: string;
}

export class PasswordGeneratorService {
  private static instance: PasswordGeneratorService;
  private generationHistory: GenerationHistory[] = [];
  private maxHistorySize = 50;

  public static getInstance(): PasswordGeneratorService {
    if (!PasswordGeneratorService.instance) {
      PasswordGeneratorService.instance = new PasswordGeneratorService();
    }
    return PasswordGeneratorService.instance;
  }

  // Generate password using specified options
  public async generatePassword(
    options: PasswordGeneratorOptions,
    templateId?: string,
  ): Promise<{ password: string; strength: PasswordStrengthResult }> {
    try {
      let password: string;

      // Handle specialized templates
      if (templateId === 'passphrase') {
        console.log(
          `📝 Service: Generating passphrase with length ${options.length}`,
        );
        password = this.generatePassphrase(
          options.length,
          options.includeNumbers,
        );
      } else if (templateId === 'memorable') {
        console.log(
          `🧠 Service: Generating memorable password with length ${options.length}`,
        );
        password = this.generateMemorablePassword(options.length);
      } else {
        // Generic password generation for all other templates
        console.log(
          '🔧 Service: Generating secure password with options:',
          options,
        );
        password = generateSecurePassword(options);
      }

      const strength = calculatePasswordStrength(password);

      console.log(
        '🔧 Service: Generated password with strength score:',
        strength.score,
      );

      // Add to history
      const historyEntry: GenerationHistory = {
        id: this.generateId(),
        password,
        timestamp: new Date(),
        options: { ...options },
        strength,
        isFavorite: false,
        templateUsed: templateId,
      };

      this.addToHistory(historyEntry);

      return { password, strength };
    } catch (error) {
      console.error('Error generating password:', error);
      throw new Error('Failed to generate password');
    }
  }

  // Generate multiple passwords for comparison
  public async generateMultiple(
    options: PasswordGeneratorOptions,
    count: number = 5,
  ): Promise<Array<{ password: string; strength: PasswordStrengthResult }>> {
    const passwords: Array<{
      password: string;
      strength: PasswordStrengthResult;
    }> = [];

    for (let i = 0; i < count; i++) {
      const result = await this.generatePassword(options);
      passwords.push(result);
    }

    return passwords;
  }

  // Generate pronounceable passwords
  public generatePronounceablePassword(length: number = 12): string {
    console.log(
      `🔧 Service: Generating pronounceable password with length ${length}`,
    );

    const syllables = PRONOUNCEABLE_SYLLABLES;

    const numbers = '23456789'; // Exclude confusing 0 and 1
    let password = '';
    let targetLength = length;

    // Start with capital letter
    let firstSyllable = syllables[Math.floor(Math.random() * syllables.length)];
    firstSyllable =
      firstSyllable.charAt(0).toUpperCase() + firstSyllable.slice(1);
    password += firstSyllable;
    targetLength -= firstSyllable.length;

    // Add syllables until we reach close to target length
    while (targetLength > 3) {
      const syllable = syllables[Math.floor(Math.random() * syllables.length)];
      password += syllable;
      targetLength -= syllable.length;
    }

    // Add numbers to reach exact length and improve security
    while (password.length < length) {
      if (targetLength <= 2 && Math.random() > 0.3) {
        // Add number
        password += numbers.charAt(Math.floor(Math.random() * numbers.length));
      } else {
        // Add vowel
        password += 'aeiou'.charAt(Math.floor(Math.random() * 5));
      }
      targetLength--;
    }

    // Ensure we don't exceed length
    const finalPassword = password.substring(0, length);
    console.log(
      `🔧 Service: Generated pronounceable password "${finalPassword}" (${finalPassword.length} chars)`,
    );
    return finalPassword;
  }

  // Generate memorable passwords using real words + numbers (easier to remember)
  public generateMemorablePassword(length: number = 12): string {
    console.log(
      `🔧 Service: Generating memorable password with length ${length}`,
    );

    const memorableWords = MEMORABLE_WORDS;
    const adjectives = MEMORABLE_ADJECTIVES;
    let password = '';
    let useAdjective = true; // Start with an adjective

    while (password.length < length) {
      let word;
      if (useAdjective) {
        word = adjectives[Math.floor(Math.random() * adjectives.length)];
      } else {
        word = memorableWords[Math.floor(Math.random() * memorableWords.length)];
      }
      useAdjective = !useAdjective; // Alternate

      // Capitalize first letter of each word
      word = word.charAt(0).toUpperCase() + word.slice(1);
      
      if (password.length + word.length <= length) {
        password += word;
      } else {
        // if the word is too long, break the loop
        break;
      }

      // Add a number if there is space
      const numDigits = Math.floor(Math.random() * 2) + 1; // 1 or 2 digits
      if (password.length + numDigits <= length) {
        const number = Math.floor(Math.random() * Math.pow(10, numDigits));
        password += number;
      } else {
        break;
      }
    }

    // If password is still shorter than length, fill with numbers
    while (password.length < length) {
      password += Math.floor(Math.random() * 10);
    }
    
    // Ensure exact length
    password = password.substring(0, length);

    console.log(
      `🔧 Service: Generated memorable password "${password}" (${password.length} chars)`,
    );
    return password;
  }

  // Generate Banking password - Maximum security
  public generateBankingPassword(length: number = 50): string {
    console.log(
      `🏦 Service: Generating Banking password with length ${length}`,
    );

    const charset = {
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      numbers: '0123456789',
      symbols: '!@#$%^&*',
    };

    let password = '';
    const allChars =
      charset.uppercase + charset.lowercase + charset.numbers + charset.symbols;

    // Guarantee at least 1 of each
    password +=
      charset.uppercase[Math.floor(Math.random() * charset.uppercase.length)];
    password +=
      charset.lowercase[Math.floor(Math.random() * charset.lowercase.length)];
    password +=
      charset.numbers[Math.floor(Math.random() * charset.numbers.length)];
    password +=
      charset.symbols[Math.floor(Math.random() * charset.symbols.length)];

    // Fill rest with random from all
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle
    password = password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');

    console.log(`✅ Generated Banking password (${password.length} chars)`);
    return password;
  }

  // Generate Social password - Pronounceable + Numbers
  public generateSocialPassword(length: number = 40): string {
    console.log(`📱 Service: Generating Social password with length ${length}`);

    const syllables = SOCIAL_PASSWORD_SYLLABLES;

    let password = '';
    let targetLength = length;

    // Start with capital letter + syllable
    let firstSyllable = syllables[Math.floor(Math.random() * syllables.length)];
    firstSyllable =
      firstSyllable.charAt(0).toUpperCase() + firstSyllable.slice(1);
    password += firstSyllable;
    targetLength -= firstSyllable.length;

    // Add syllables
    while (targetLength > 5) {
      const syllable = syllables[Math.floor(Math.random() * syllables.length)];
      password += syllable;
      targetLength -= syllable.length;
    }

    // Add 2-3 digit numbers
    const numbers = Math.floor(Math.random() * 900) + 100;
    password += numbers;

    password = password.substring(0, length);

    console.log(`✅ Generated Social password (${password.length} chars)`);
    return password;
  }

  // Generate Email password - Balanced security
  public generateEmailPassword(length: number = 38): string {
    console.log(`📧 Service: Generating Email password with length ${length}`);

    const charset = {
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      numbers: '0123456789',
      symbols: '!@#$%',
    };

    let password = '';

    // Start with uppercase
    password +=
      charset.uppercase[Math.floor(Math.random() * charset.uppercase.length)];

    for (let i = password.length; i < length; i++) {
      const section = i % 3;
      if (section === 0) {
        password +=
          charset.lowercase[
            Math.floor(Math.random() * charset.lowercase.length)
          ];
      } else if (section === 1) {
        password +=
          charset.numbers[Math.floor(Math.random() * charset.numbers.length)];
      } else {
        password +=
          charset.symbols[Math.floor(Math.random() * charset.symbols.length)];
      }
    }

    console.log(`✅ Generated Email password (${password.length} chars)`);
    return password;
  }

  // Generate Business password - Professional
  public generateBusinessPassword(length: number = 46): string {
    console.log(
      `💼 Service: Generating Business password with length ${length}`,
    );

    const words = [
      'Pro',
      'Secure',
      'Safe',
      'Prime',
      'Elite',
      'Premium',
      'Corp',
      'Enterprise',
      'Turbo',
      'Ultra',
      'Super',
      'Power',
    ];

    const adjectives = [
      'Alpha',
      'Beta',
      'Delta',
      'Sigma',
      'Omega',
      'Forte',
      'Nexus',
      'Apex',
      'Vertex',
    ];

    const word = words[Math.floor(Math.random() * words.length)];
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const number = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    const symbol = ['@', '#', '$', '%', '!'][Math.floor(Math.random() * 5)];

    let password = `${word}${adjective}${symbol}${number}`;

    // Add more security if needed
    const charset =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    while (password.length < length) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }

    password = password.substring(0, length);

    console.log(`✅ Generated Business password (${password.length} chars)`);
    return password;
  }

  // Generate Gaming password - Fun but secure
  public generateGamingPassword(length: number = 24): string {
    console.log(`🎮 Service: Generating Gaming password with length ${length}`);

    const gameWords = [
      'Player',
      'Master',
      'Pro',
      'King',
      'Quest',
      'Hero',
      'Gamer',
      'Legend',
      'Nexus',
      'Portal',
      'Arena',
      'Forge',
    ];

    const suffixes = [
      'One',
      'Two',
      'Max',
      'Ultra',
      'Elite',
      'Prime',
      'Ascend',
      'Omega',
    ];

    const word = gameWords[Math.floor(Math.random() * gameWords.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const number = Math.floor(Math.random() * 999) + 1;

    let password = `${word}${suffix}${number}`;

    // Add symbols and padding if needed
    const symbols = '!@#$%';
    while (password.length < length) {
      password += symbols[Math.floor(Math.random() * symbols.length)];
    }

    password = password.substring(0, length);

    console.log(`✅ Generated Gaming password (${password.length} chars)`);
    return password;
  }

  // Generate Shopping password - Secure but shareable
  public generateShoppingPassword(length: number = 26): string {
    console.log(
      `🛍️  Service: Generating Shopping password with length ${length}`,
    );

    const words = [
      'Buy',
      'Shop',
      'Cart',
      'Pay',
      'Store',
      'Deal',
      'Sale',
      'Shop',
      'Checkout',
    ];

    const qualifiers = [
      'Safe',
      'Secure',
      'Pro',
      'Max',
      'Plus',
      'Prime',
      'Guard',
    ];

    const word = words[Math.floor(Math.random() * words.length)];
    const qualifier = qualifiers[Math.floor(Math.random() * qualifiers.length)];
    const year = new Date().getFullYear();
    const number = Math.floor(Math.random() * 100) + 1;

    let password = `${word}${qualifier}${year}${number}`;

    // Add one symbol for security
    const symbol = ['@', '#', '!'][Math.floor(Math.random() * 3)];
    password += symbol;

    password = password.substring(0, length);

    console.log(`✅ Generated Shopping password (${password.length} chars)`);
    return password;
  }

  // Generate WiFi password with pattern: Word@Word2024#Word!Numbers
  public generateWiFiPassword(length: number = 34): string {
    console.log(`🔧 Service: Generating WiFi password with length ${length}`);

    const words = [
      'WiFi',
      'Network',
      'Home',
      'Secure',
      'Safe',
      'Signal',
      'Access',
      'Guest',
      'Connect',
      'Link',
      'Online',
      'Bright',
      'Quick',
      'Strong',
      'Smart',
      'Cool',
      'Cloud',
      'Speed',
      'Guard',
      'Portal',
      'Router',
      'Server',
      'Prime',
      'Elite',
      'Premium',
      'Turbo',
      'Ultra',
      'Super',
      'Power',
      'Mighty',
    ];

    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];

    // Select 3 random words
    const word1 = words[Math.floor(Math.random() * words.length)];
    const word2 = words[Math.floor(Math.random() * words.length)];
    const word3 = words[Math.floor(Math.random() * words.length)];
    const year = years[Math.floor(Math.random() * years.length)];

    // Generate 4-digit numbers
    const numbers1 = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    const numbers2 = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');

    // Pattern: Word1@Word22024#Word3!Numbers
    let password = `${word1}@${word2}${year}#${word3}!${numbers1}`;

    // Adjust to exact length if needed
    if (password.length < length) {
      password += numbers2;
    } else if (password.length > length) {
      password = password.substring(0, length);
    }

    console.log(
      `🔧 Service: Generated WiFi password "${password}" (${password.length} chars)`,
    );
    return password;
  }

  // Generate pattern-based passwords (e.g., Word-Number-Symbol-Word)
  public generatePatternPassword(pattern: string): string {
    console.log(
      `🔧 Service: Generating pattern password with pattern "${pattern}"`,
    );

    const words = [
      'Blue',
      'Red',
      'Green',
      'Gold',
      'Silver',
      'Bright',
      'Dark',
      'Light',
      'Fast',
      'Quick',
      'Strong',
      'Smart',
      'Cool',
      'Hot',
      'Big',
      'Small',
      'Sun',
      'Moon',
      'Star',
      'Ocean',
      'River',
      'Mountain',
      'Forest',
      'Sky',
      'Wind',
      'Fire',
      'Earth',
      'Water',
      'Cloud',
      'Snow',
      'Rain',
      'Storm',
      'Home',
      'House',
      'City',
      'Town',
      'Road',
      'Path',
      'Bridge',
      'Garden',
      'Tree',
      'Flower',
      'Bird',
      'Cat',
      'Dog',
      'Lion',
      'Eagle',
      'Wolf',
      'Book',
      'Key',
      'Door',
      'Window',
      'Phone',
      'Car',
      'Bike',
      'Train',
      'Music',
      'Song',
      'Dance',
      'Game',
      'Play',
      'Fun',
      'Joy',
      'Love',
      'Net',
      'Web',
      'Link',
      'Connect',
      'WiFi',
      'Signal',
      'Network',
      'Online',
      'Data',
      'Speed',
      'Secure',
      'Safe',
      'Access',
      'Guest',
      'Home',
      'Bright',
      'Quick',
      'Strong',
      'Sweet',
      'Gentle',
      'Brave',
      'Calm',
      'Wild',
      'Soft',
      'Sharp',
      'Smooth',
      'Fresh',
      'Clean',
      'Pure',
      'Rich',
      'Deep',
      'Warm',
      'Cool',
      'Hot',
      'Cold',
      'Fast',
      'Slow',
      'Big',
      'Small',
      'Tall',
      'Short',
      'Wide',
      'Narrow',
      'Thick',
      'Thin',
      'Heavy',
      'Light',
      'Dark',
      'Bright',
      'Shiny',
      'Dull',
      'Colorful',
      'Pale',
      'Vivid',
      'Lively',
      'Quiet',
      'Noisy',
      'Loud',
      'Silent',
      'Peaceful',
      'Angry',
      'Happy',
      'Sad',
      'Joyful',
      'Cheerful',
      'Merry',
      'Friendly',
      'Kind',
      'Gentle',
      'Rough',
      'Polite',
      'Rude',
      'Honest',
      'Dishonest',
      'Brave',
      'Cowardly',
      'Wise',
      'Foolish',
      'Smart',
      'Clever',
      'Dumb',
      'Stupid',
      'Lazy',
      'Hardworking',
      'Energetic',
      'Tired',
      'Hungry',
      'Thirsty',
      'Full',
      'Empty',
      'Open',
      'Closed',
      'Safe',
      'Dangerous',
      'Secure',
      'Insecure',
      'Strong',
      'Weak',
      'Healthy',
      'Sick',
      'Rich',
      'Poor',
      'Wealthy',
      'Needy',
      'Generous',
      'Greedy',
      'Selfish',
      'Unselfish',
      'Happy',
      'Sad',
      'Angry',
      'Calm',
      'Excited',
      'Bored',
      'Interested',
      'Uninterested',
      'Curious',
      'Uncurious',
      'Brave',
      'Cowardly',
      'Bold',
      'Timid',
      'Confident',
      'Shy',
      'Outgoing',
      'Reserved',
      'Talkative',
      'Quiet',
      'Loud',
      'Noisy',
      'Silent',
      'Peaceful',
      'Violent',
      'Gentle',
      'Rough',
      'Polite',
      'Rude',
      'Friendly',
      'Unfriendly',
      'Kind',
      'Mean',
      'Nice',
      'Nasty',
      'Sweet',
      'Sour',
      'Bitter',
      'Salty',
      'Spicy',
      'Hot',
      'Cold',
      'Warm',
      'Cool',
      'Fresh',
      'Stale',
      'Clean',
      'Dirty',
      'Pure',
      'Impure',
      'Rich',
      'Poor',
      'Wealthy',
      'Needy',
      'Generous',
      'Greedy',
      'Selfish',
      'Unselfish',
      'Happy',
      'Sad',
      'Angry',
      'Calm',
      'Excited',
      'Bored',
      'Interested',
      'Uninterested',
      'Curious',
      'Uncurious',
      'Brave',
      'Cowardly',
      'Bold',
      'Timid',
      'Confident',
      'Shy',
      'Outgoing',
      'Reserved',
      'Talkative',
      'Quiet',
    ];

    const networkWords = [
      'Net',
      'Web',
      'Link',
      'Connect',
      'WiFi',
      'Signal',
      'Network',
      'Online',
      'Data',
      'Speed',
      'Fast',
      'Secure',
      'Safe',
      'Access',
      'Guest',
      'Home',
      'Router',
      'Modem',
      'Switch',
      'Hub',
      'Cable',
      'Fiber',
      'Ethernet',
      'LAN',
      'WAN',
      'VPN',
      'Proxy',
      'Firewall',
      'Server',
      'Client',
      'Host',
      'Node',
      'Cloud',
      'Edge',
      'Gateway',
      'Bridge',
      'Repeater',
      'Antenna',
      'Satellite',
      'Broadband',
      'Dialup',
      'DSL',
      'ADSL',
      'ISDN',
      'T1',
      'T3',
      '4G',
      '5G',
      'LTE',
      'WiMAX',
      'Bluetooth',
      'Infrared',
      'NFC',
      'RFID',
      'Zigbee',
      'LoRa',
      'Mesh',
      'Topology',
      'Protocol',
      'IP',
      'TCP',
      'UDP',
      'DNS',
      'DHCP',
      'HTTP',
      'HTTPS',
      'FTP',
      'SFTP',
      'SMTP',
      'IMAP',
      'POP3',
      'SNMP',
      'Telnet',
      'SSH',
      'Ping',
      'Traceroute',
      'Bandwidth',
      'Latency',
      'Jitter',
      'Packet',
      'Frame',
      'Bit',
      'Byte',
      'Kilobyte',
      'Megabyte',
      'Gigabyte',
      'Terabyte',
      'Petabyte',
      'Exabyte',
      'Zettabyte',
      'Yottabyte',
      'Upload',
      'Download',
      'Stream',
      'Buffer',
      'Cache',
      'Cookie',
      'Session',
      'Token',
      'Key',
      'Certificate',
      'Encryption',
      'Decryption',
      'Hash',
      'Checksum',
      'Digest',
      'Signature',
      'Authentication',
      'Authorization',
      'Access',
      'Control',
      'Policy',
      'Rule',
      'Filter',
      'Firewall',
      'Intrusion',
      'Detection',
      'Prevention',
      'System',
      'Antivirus',
      'Malware',
      'Spyware',
      'Adware',
      'Ransomware',
      'Phishing',
      'Spoofing',
      'Sniffing',
      'Hacking',
      'Cracking',
      'Exploiting',
      'Penetration',
      'Testing',
      'Audit',
      'Compliance',
      'Governance',
      'Risk',
      'Management',
      'Incident',
      'Response',
      'Recovery',
      'Backup',
      'Restore',
      'Disaster',
      'Recovery',
      'Business',
      'Continuity',
      'Plan',
      'Strategy',
      'Policy',
      'Rule',
    ];

    const numbers = '123456789';
    const symbols = '!@#$%^&*';
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];

    const result = pattern
      .replace(/W/g, () => words[Math.floor(Math.random() * words.length)])
      .replace(/w/g, () =>
        words[Math.floor(Math.random() * words.length)].toLowerCase(),
      )
      .replace(/N/g, () =>
        numbers.charAt(Math.floor(Math.random() * numbers.length)),
      )
      .replace(/S/g, () =>
        symbols.charAt(Math.floor(Math.random() * symbols.length)),
      )
      .replace(/D/g, () => Math.floor(Math.random() * 100).toString())
      .replace(/Y/g, () =>
        years[Math.floor(Math.random() * years.length)].toString(),
      )
      .replace(
        /Z/g,
        () => networkWords[Math.floor(Math.random() * networkWords.length)],
      );

    console.log(
      `🔧 Service: Generated pattern password "${result}" (${result.length} chars)`,
    );
    return result;
  }

  // History management
  public getHistory(): GenerationHistory[] {
    return [...this.generationHistory].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );
  }

  public addToHistory(entry: GenerationHistory): void {
    this.generationHistory.unshift(entry);

    // Keep only the most recent entries
    if (this.generationHistory.length > this.maxHistorySize) {
      this.generationHistory = this.generationHistory.slice(
        0,
        this.maxHistorySize,
      );
    }
  }

  public toggleFavorite(entryId: string): void {
    const entry = this.generationHistory.find(e => e.id === entryId);
    if (entry) {
      entry.isFavorite = !entry.isFavorite;
    }
  }

  public removeFromHistory(entryId: string): void {
    this.generationHistory = this.generationHistory.filter(
      e => e.id !== entryId,
    );
  }

  // Generate passphrase using word combinations (e.g., "BlueSky2024Fast")
  public generatePassphrase(
    length: number = 34,
    includeNumbers: boolean = true,
  ): string {
    console.log(`📝 Service: Generating passphrase with length ${length}`);

    const words = PASSPHRASE_WORDS;

    let passphrase = '';
    let currentLength = 0;

    // Add words until we approach target length
    while (currentLength < length - 4) {
      const word = words[Math.floor(Math.random() * words.length)];
      passphrase += word;
      currentLength += word.length;
    }

    // Add year or numbers to reach target length
    if (includeNumbers) {
      const currentYear = new Date().getFullYear();
      const years = [
        currentYear - 1,
        currentYear,
        currentYear + 1,
        currentYear + 2,
      ];
      const year = years[Math.floor(Math.random() * years.length)];
      const yearStr = year.toString();

      // If passphrase + year is too long, remove words from end
      if (passphrase.length + yearStr.length > length) {
        passphrase = passphrase.substring(0, length - yearStr.length);
      }

      passphrase += yearStr;
    }

    // Ensure exact length by truncating if needed
    if (passphrase.length > length) {
      passphrase = passphrase.substring(0, length);
    }

    console.log(
      `✅ Service: Generated passphrase "${passphrase}" (${passphrase.length} chars)`,
    );
    return passphrase;
  }

  public clearHistory(): void {
    this.generationHistory = [];
  }

  public getFavorites(): GenerationHistory[] {
    return this.generationHistory.filter(entry => entry.isFavorite);
  }

  // Utility methods
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Export history for backup
  public exportHistory(): string {
    return JSON.stringify(
      {
        version: '1.0',
        timestamp: new Date().toISOString(),
        history: this.generationHistory,
      },
      null,
      2,
    );
  }

  // Import history from backup
  public importHistory(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      if (parsed.history && Array.isArray(parsed.history)) {
        this.generationHistory = parsed.history.map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error importing history:', error);
      return false;
    }
  }
}

export const passwordGeneratorService = PasswordGeneratorService.getInstance();
