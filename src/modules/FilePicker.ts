import { NativeModules } from 'react-native';

interface FilePickerModule {
  /**
   * Opens a file picker dialog for the user to select a JSON file
   * Returns the file path if a file is selected
   * Returns empty string if user cancels/goes back
   * Throws error only on critical failures (e.g., permission issues)
   */
  pickFile(): Promise<string>;
}

const { FilePicker } = NativeModules;

export default FilePicker as FilePickerModule;
