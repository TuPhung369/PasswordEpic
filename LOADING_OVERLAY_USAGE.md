# Loading Overlay Usage Guide

## Overview

The Loading Overlay provides a global full-screen video loading indicator across the app. It displays `logo_loading.mp4` in a looping animation.

## How to Use

### In any screen or component:

```typescript
import { useLoadingOverlay } from '../contexts/LoadingOverlayContext';

export const MyScreen: React.FC = () => {
  const { show, hide } = useLoadingOverlay();

  const handleAsyncOperation = async () => {
    show();
    try {
      // Your async operation
      await someAsyncTask();
    } finally {
      hide();
    }
  };

  return (
    <View>
      <Button onPress={handleAsyncOperation} title="Start Operation" />
    </View>
  );
};
```

### Example with BackupRestoreModal:

```typescript
const handleRestoreBackup = async () => {
  const { show, hide } = useLoadingOverlay();
  show();
  try {
    // Restore logic
    await restoreBackup();
  } catch (error) {
    // Handle error
  } finally {
    hide();
  }
};
```

## API

- `show()` - Display the full-screen video loading overlay
- `hide()` - Hide the loading overlay
- `isVisible` - Current visibility state (boolean)

## Features

- Full-screen overlay
- Looping video animation
- Black background
- Non-dismissible (modal style)
