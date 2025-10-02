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

  // Enhanced fields for Week 6
  customFields?: CustomField[];
  attachments?: Attachment[];
  auditData?: AuditData;
  passwordHistory?: PasswordHistoryEntry[];
  breachStatus?: BreachStatus;
  riskScore?: number; // 0-100
  accessCount?: number;
  frequencyScore?: number; // 0-100
  folderPath?: string;
  sharing?: SharingSettings;
  permissions?: Permission[];
  source?: ImportSource;
  importedAt?: Date;
  exportedAt?: Date;
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

// Enhanced interfaces for Week 6
export interface CustomField {
  id: string;
  name: string;
  value: string;
  type: 'text' | 'password' | 'email' | 'url' | 'phone' | 'date' | 'number';
  isHidden: boolean;
  createdAt: Date;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  encryptedData: string;
  checksum: string;
  createdAt: Date;
}

export interface AuditData {
  passwordStrength: PasswordStrengthResult;
  duplicateCount: number;
  compromisedCount: number;
  lastPasswordChange: Date;
  recommendedAction?: 'none' | 'change_password' | 'enable_2fa' | 'update_info';
  securityScore: number; // 0-100
}

export interface PasswordHistoryEntry {
  id: string;
  password: string;
  createdAt: Date;
  strength: PasswordStrengthResult;
}

export interface BreachStatus {
  isBreached: boolean;
  breachCount: number;
  lastChecked: Date;
  breachSources: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SharingSettings {
  isShared: boolean;
  sharedWith: string[];
  permissions: SharePermission[];
  shareExpiry?: Date;
  shareLink?: string;
}

export interface SharePermission {
  userId: string;
  permission: 'view' | 'edit' | 'admin';
  grantedAt: Date;
  grantedBy: string;
}

export interface Permission {
  type: 'read' | 'write' | 'delete' | 'share';
  granted: boolean;
  reason?: string;
}

export interface ImportSource {
  type: 'manual' | 'csv' | 'browser' | 'another_app';
  source: string;
  version?: string;
  metadata?: Record<string, any>;
}

// Enhanced category interface
export interface PasswordCategoryExtended extends PasswordCategory {
  description?: string;
  parentId?: string;
  children?: PasswordCategoryExtended[];
  entryCount: number;
  lastUsed?: Date;
  isCustom: boolean;
  sortOrder: number;
}

// Search and filtering interfaces
export interface SearchFilters {
  query: string;
  categories: string[];
  tags: string[];
  favorites: boolean;
  weakPasswords: boolean;
  duplicates: boolean;
  compromised: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  strengthRange?: {
    min: number;
    max: number;
  };
}

export interface SortOptions {
  field:
    | 'title'
    | 'username'
    | 'website'
    | 'createdAt'
    | 'updatedAt'
    | 'lastUsed'
    | 'strength'
    | 'accessCount';
  direction: 'asc' | 'desc';
}

// Bulk operations
export interface BulkOperation {
  type: 'delete' | 'move' | 'update' | 'export';
  entryIds: string[];
  targetCategory?: string;
  updateData?: Partial<PasswordEntry>;
}

// Sync and conflict resolution
export interface SyncConflict {
  entryId: string;
  localEntry: PasswordEntry;
  remoteEntry: PasswordEntry;
  conflictType: 'update' | 'delete' | 'create';
  timestamp: Date;
}

export interface SyncStatus {
  isOnline: boolean;
  lastSync?: Date;
  pendingOperations: number;
  conflicts: SyncConflict[];
  syncInProgress: boolean;
}
