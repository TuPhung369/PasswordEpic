import { NativeModules } from 'react-native';

interface FilePickerModule {
  pickFile(): Promise<string>;
}

const { FilePicker } = NativeModules;

export default FilePicker as FilePickerModule;
