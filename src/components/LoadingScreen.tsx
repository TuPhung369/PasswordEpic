import React from 'react';
import { View, StyleSheet, Modal, Dimensions } from 'react-native';
import Video from 'react-native-video';

interface LoadingScreenProps {
  visible: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ visible }) => {
  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.container}>
        <Video
          source={require('../../logo_loading.mp4')}
          style={styles.video}
          resizeMode="cover"
          repeat
          muted
          paused={false}
        />
      </View>
    </Modal>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width,
    aspectRatio: 1,
  },
});
