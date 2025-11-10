import { NativeModules } from 'react-native';

interface FilePickerOptions {
  fileType?: string;
}

interface FilePickerModule {
  /**
   * Opens a file picker dialog for the user to select a file
   * Defaults to JSON files
   * Returns the file path if a file is selected
   * Returns empty string if user cancels/goes back
   * Throws error only on critical failures (e.g., permission issues)
   */
  pickFile(): Promise<string>;
  
  /**
   * Opens a file picker dialog with custom options
   * @param options - Configuration options including fileType (MIME type, default: "*\/*" for all files)
   * Returns the file path if a file is selected
   */
  pickFileWithOptions(options: FilePickerOptions): Promise<string>;

  /**
   * Opens a folder picker dialog for the user to select a destination folder
   * Returns the folder URI (on Android) or path (on iOS) if a folder is selected
   * Returns empty string if user cancels/goes back
   * Throws error only on critical failures (e.g., permission issues)
   */
  pickFolder(): Promise<string>;

  /**
   * Writes content to a file in the specified folder
   * @param folderUri - The folder URI from pickFolder
   * @param fileName - The name of the file to create
   * @param content - The file content to write
   * Returns the file URI/path if successful
   */
  writeToFolder(folderUri: string, fileName: string, content: string): Promise<string>;
}

const { FilePicker } = NativeModules;

export default FilePicker as FilePickerModule;
