// Type declarations for react-native-fs
declare module 'react-native-fs' {
  export const DownloadDirectoryPath: string;
  export const DocumentDirectoryPath: string;
  export const ExternalDirectoryPath: string;
  export const ExternalStorageDirectoryPath: string;
  export const TemporaryDirectoryPath: string;
  export const LibraryDirectoryPath: string;
  export const CachesDirectoryPath: string;

  export function writeFile(
    filepath: string,
    contents: string,
    encoding?: string,
  ): Promise<void>;

  export function readFile(
    filepath: string,
    encoding?: string,
  ): Promise<string>;

  export function readdir(dirpath: string): Promise<string[]>;

  export function stat(filepath: string): Promise<{
    isFile(): boolean;
    isDirectory(): boolean;
    size: number;
    mtime: Date;
    ctime: Date;
  }>;

  export function exists(filepath: string): Promise<boolean>;

  export function unlink(filepath: string): Promise<void>;

  export function mkdir(
    filepath: string,
    options?: {
      NSURLIsExcludedFromBackupKey?: boolean;
    },
  ): Promise<void>;

  export function moveFile(filepath: string, destPath: string): Promise<void>;

  export function copyFile(filepath: string, destPath: string): Promise<void>;
}

// Type declarations for react-native-permissions
declare module 'react-native-permissions' {
  export const PERMISSIONS: {
    ANDROID: {
      WRITE_EXTERNAL_STORAGE: string;
      READ_EXTERNAL_STORAGE: string;
    };
    IOS: {
      PHOTO_LIBRARY: string;
    };
  };

  export const RESULTS: {
    GRANTED: string;
    DENIED: string;
    NEVER_ASK_AGAIN: string;
    BLOCKED: string;
    UNAVAILABLE: string;
  };

  export function request(permission: string): Promise<string>;
  export function check(permission: string): Promise<string>;
}
