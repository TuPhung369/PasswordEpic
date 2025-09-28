export interface PasswordEntry {
  id: string;
  title: string;
  username: string;
  password: string;
  website?: string;
  notes?: string;
  category?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
  isFavorite: boolean;
}

export interface EncryptedPasswordEntry {
  id: string;
  encryptedData: string; // JSON string of encrypted PasswordEntry
  salt: string; // Unique salt for this entry
  iv: string; // Initialization vector
  authTag: string; // Authentication tag for integrity
  createdAt: Date;
  updatedAt: Date;
}

export interface PasswordCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  createdAt: Date;
}

export interface PasswordStrengthResult {
  score: number; // 0-4
  label: string; // Very Weak, Weak, Fair, Good, Strong
  color: string;
  feedback: string[];
  crackTime: string;
}

export interface PasswordGeneratorOptions {
  length: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
  excludeSimilar: boolean;
  excludeAmbiguous: boolean;
  customCharacters?: string;
  minNumbers?: number;
  minSymbols?: number;
}
