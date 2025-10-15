import { generateSecurePassword } from '../utils/passwordUtils';
import {
  PasswordGeneratorOptions,
  PasswordStrengthResult,
} from '../types/password';
import { calculatePasswordStrength } from '../utils/passwordUtils';

export interface PasswordTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  options: PasswordGeneratorOptions;
  category: 'security' | 'usability' | 'specific';
  examples: string[];
}

export interface GeneratorPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  options: PasswordGeneratorOptions;
  color: string;
}

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

  // Predefined templates for different use cases
  public getTemplates(): PasswordTemplate[] {
    return [
      {
        id: 'banking',
        name: 'Banking & Finance',
        description: 'Ultra-secure passwords for financial accounts',
        icon: 'account-balance',
        category: 'security',
        options: {
          length: 16,
          includeUppercase: true,
          includeLowercase: true,
          includeNumbers: true,
          includeSymbols: true,
          excludeSimilar: true,
          excludeAmbiguous: true,
          minNumbers: 3,
          minSymbols: 2,
        },
        examples: ['K9#mP2$rL4xN8@qW', 'R7&nQ3!sM5yT9#eA'],
      },
      {
        id: 'social',
        name: 'Social Media',
        description: 'Memorable yet secure for social platforms',
        icon: 'people',
        category: 'usability',
        options: {
          length: 12,
          includeUppercase: true,
          includeLowercase: true,
          includeNumbers: true,
          includeSymbols: false,
          excludeSimilar: true,
          excludeAmbiguous: false,
          minNumbers: 2,
        },
        examples: ['BrightSun42Me', 'Ocean7Wave3'],
      },
      {
        id: 'email',
        name: 'Email Accounts',
        description: 'Strong passwords for email security',
        icon: 'email',
        category: 'security',
        options: {
          length: 14,
          includeUppercase: true,
          includeLowercase: true,
          includeNumbers: true,
          includeSymbols: true,
          excludeSimilar: true,
          excludeAmbiguous: true,
          minNumbers: 2,
          minSymbols: 1,
        },
        examples: ['Mail9#Secure2K', 'Inbox4$Safe7T'],
      },
      {
        id: 'wifi',
        name: 'WiFi Network',
        description: 'Easy to type and share WiFi passwords',
        icon: 'wifi',
        category: 'usability',
        options: {
          length: 10,
          includeUppercase: true,
          includeLowercase: true,
          includeNumbers: true,
          includeSymbols: false,
          excludeSimilar: true,
          excludeAmbiguous: true,
          minNumbers: 2,
        },
        examples: ['HomeNet2024', 'GuestWifi99'],
      },
      {
        id: 'gaming',
        name: 'Gaming Accounts',
        description: 'Fun yet secure for gaming platforms',
        icon: 'games',
        category: 'usability',
        options: {
          length: 13,
          includeUppercase: true,
          includeLowercase: true,
          includeNumbers: true,
          includeSymbols: true,
          excludeSimilar: false,
          excludeAmbiguous: false,
          minNumbers: 2,
          minSymbols: 1,
        },
        examples: ['Player1*Best', 'Game7#Hero9'],
      },
      {
        id: 'work',
        name: 'Work & Corporate',
        description: 'Professional passwords for work accounts',
        icon: 'work',
        category: 'security',
        options: {
          length: 15,
          includeUppercase: true,
          includeLowercase: true,
          includeNumbers: true,
          includeSymbols: true,
          excludeSimilar: true,
          excludeAmbiguous: true,
          minNumbers: 2,
          minSymbols: 2,
        },
        examples: ['Work2024#Safe!', 'Corp9$Secure@'],
      },
      {
        id: 'memorable',
        name: 'Memorable',
        description: 'Easy to remember patterns',
        icon: 'psychology',
        category: 'usability',
        options: {
          length: 11,
          includeUppercase: true,
          includeLowercase: true,
          includeNumbers: true,
          includeSymbols: false,
          excludeSimilar: true,
          excludeAmbiguous: true,
          minNumbers: 2,
        },
        examples: ['BlueSky2024', 'RedCar789Go'],
      },
      {
        id: 'maximum',
        name: 'Maximum Security',
        description: 'Highest security for critical accounts',
        icon: 'security',
        category: 'security',
        options: {
          length: 20,
          includeUppercase: true,
          includeLowercase: true,
          includeNumbers: true,
          includeSymbols: true,
          excludeSimilar: true,
          excludeAmbiguous: true,
          minNumbers: 4,
          minSymbols: 3,
        },
        examples: ['X9#mK2$rQ7!nP5@wL4&z', 'A8%nM3*sR6#qT9$eY2!u'],
      },
    ];
  }

  // Quick presets for common scenarios
  public getPresets(): GeneratorPreset[] {
    // Import presets from component to avoid duplication
    const { DEFAULT_PRESETS } = require('../components/GeneratorPresets');

    // Convert component presets to service format (add missing properties)
    return DEFAULT_PRESETS.map((preset: any) => ({
      ...preset,
      options: {
        ...preset.options,
        excludeSimilar:
          preset.options.excludeSimilar !== undefined
            ? preset.options.excludeSimilar
            : true,
        excludeAmbiguous:
          preset.options.excludeAmbiguous !== undefined
            ? preset.options.excludeAmbiguous
            : false,
        minNumbers: preset.options.minNumbers || 0,
        minSymbols: preset.options.minSymbols || 0,
      },
    }));
  }

  // Generate password using specified options
  public async generatePassword(
    options: PasswordGeneratorOptions,
    templateId?: string,
  ): Promise<{ password: string; strength: PasswordStrengthResult }> {
    try {
      console.log(
        '🔧 Service: Generating secure password with options:',
        options,
      );

      const password = generateSecurePassword(options);
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

    // Common syllables that are easy to pronounce
    const syllables = [
      'ba',
      'be',
      'bi',
      'bo',
      'bu',
      'by',
      'ca',
      'ce',
      'ci',
      'co',
      'cu',
      'cy',
      'da',
      'de',
      'di',
      'do',
      'du',
      'dy',
      'fa',
      'fe',
      'fi',
      'fo',
      'fu',
      'fy',
      'ga',
      'ge',
      'gi',
      'go',
      'gu',
      'gy',
      'ha',
      'he',
      'hi',
      'ho',
      'hu',
      'hy',
      'ka',
      'ke',
      'ki',
      'ko',
      'ku',
      'ky',
      'la',
      'le',
      'li',
      'lo',
      'lu',
      'ly',
      'ma',
      'me',
      'mi',
      'mo',
      'mu',
      'my',
      'na',
      'ne',
      'ni',
      'no',
      'nu',
      'ny',
      'pa',
      'pe',
      'pi',
      'po',
      'pu',
      'py',
      'ra',
      're',
      'ri',
      'ro',
      'ru',
      'ry',
      'sa',
      'se',
      'si',
      'so',
      'su',
      'sy',
      'ta',
      'te',
      'ti',
      'to',
      'tu',
      'ty',
      'va',
      've',
      'vi',
      'vo',
      'vu',
      'vy',
      'wa',
      'we',
      'wi',
      'wo',
      'wu',
      'wy',
      'za',
      'ze',
      'zi',
      'zo',
      'zu',
      'zy',
    ];

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

    // Simple, common words that are easy to remember
    const memorableWords = [
      'Sun',
      'Moon',
      'Star',
      'Sky',
      'Sea',
      'Tree',
      'Cat',
      'Dog',
      'Bird',
      'Fish',
      'Red',
      'Blue',
      'Gold',
      'Pink',
      'Green',
      'White',
      'Black',
      'Gray',
      'Big',
      'Small',
      'Fast',
      'Slow',
      'Hot',
      'Cold',
      'New',
      'Old',
      'Good',
      'Nice',
      'Cool',
      'Warm',
      'Safe',
      'Happy',
      'Lucky',
      'Smart',
      'Home',
      'Work',
      'Play',
      'Game',
      'Book',
      'Key',
      'Door',
      'Car',
      'Love',
      'Hope',
      'Dream',
      'Life',
      'Time',
      'Day',
      'Year',
      'Way',
      'Light',
      'Dark',
      'Rain',
      'Storm',
      'Cloud',
      'Snow',
      'River',
      'Mountain',
      'Forest',
      'Path',
      'Road',
      'Bridge',
      'Garden',
      'Flower',
      'Leaf',
      'Stone',
      'Rock',
      'Sand',
      'Beach',
      'Wave',
      'Shell',
      'Boat',
      'Ship',
      'Island',
      'Castle',
      'Tower',
      'Knight',
      'King',
      'Queen',
      'Prince',
      'Princess',
      'Hero',
      'Villain',
      'Dragon',
      'Wizard',
      'Magic',
      'Spell',
      'Potion',
      'Sword',
      'Shield',
      'Arrow',
      'Bow',
      'Helmet',
      'Armor',
      'Battle',
      'War',
      'Peace',
      'Friend',
      'Enemy',
      'Ally',
      'Stranger',
      'Traveler',
      'Explorer',
      'Hunter',
      'Gatherer',
      'Farmer',
      'Builder',
      'Maker',
      'Creator',
      'Inventor',
      'Artist',
      'Singer',
      'Dancer',
      'Writer',
      'Reader',
      'Thinker',
      'Dreamer',
      'Leader',
      'Follower',
      'Teacher',
      'Student',
      'Child',
      'Parent',
      'Family',
      'Friendship',
      'Love',
      'Happiness',
      'Joy',
      'Sadness',
      'Anger',
      'Fear',
      'Courage',
      'Bravery',
      'Wisdom',
      'Knowledge',
      'Truth',
      'Justice',
      'Freedom',
      'Honor',
      'Glory',
      'Victory',
      'Defeat',
      'Challenge',
      'Adventure',
      'Journey',
      'Quest',
      'Mission',
      'Goal',
      'Purpose',
      'Destiny',
      'Fate',
      'Luck',
      'Chance',
      'Opportunity',
      'Choice',
      'Decision',
      'Action',
      'Effort',
      'Work',
      'Success',
      'Failure',
      'Progress',
      'Growth',
      'Change',
      'Time',
      'Moment',
      'Memory',
      'History',
      'Future',
      'Past',
      'Present',
      'Reality',
      'Dream',
      'Fantasy',
      'Imagination',
      'Creativity',
      'Inspiration',
      'Idea',
      'Thought',
      'Mind',
      'Soul',
      'Heart',
      'Body',
      'Spirit',
      'Energy',
      'Power',
      'Strength',
      'Weakness',
      'Speed',
      'Agility',
      'Skill',
      'Talent',
      'Ability',
      'Potential',
      'Achievement',
      'Accomplishment',
      'Mastery',
      'Excellence',
    ];

    const adjectives = [
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

    let password = '';

    // Strategy: Adjective + Noun + Year/Number
    if (length >= 10) {
      // Long password: Adjective + Noun + 4-digit year
      const adjective =
        adjectives[Math.floor(Math.random() * adjectives.length)];
      const noun =
        memorableWords[Math.floor(Math.random() * memorableWords.length)];
      const currentYear = new Date().getFullYear();
      const years = [
        currentYear - 1,
        currentYear,
        currentYear + 1,
        currentYear + 2,
      ];
      const year = years[Math.floor(Math.random() * years.length)];

      password = `${adjective}${noun}${year}`;
    } else if (length >= 8) {
      // Medium password: Noun + 3-digit number
      const noun =
        memorableWords[Math.floor(Math.random() * memorableWords.length)];
      const number = Math.floor(Math.random() * 900) + 100; // 100-999
      password = `${noun}${number}`;
    } else {
      // Short password: Noun + 2-digit number
      const noun =
        memorableWords[Math.floor(Math.random() * memorableWords.length)];
      const number = Math.floor(Math.random() * 90) + 10; // 10-99
      password = `${noun}${number}`;
    }

    // Adjust length if needed
    if (password.length > length) {
      password = password.substring(0, length);
    } else if (password.length < length) {
      // Add additional numbers to reach target length
      while (password.length < length) {
        password += Math.floor(Math.random() * 10);
      }
    }

    console.log(
      `🔧 Service: Generated memorable password "${password}" (${password.length} chars)`,
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
