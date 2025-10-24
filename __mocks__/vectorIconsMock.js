// Mock for react-native-vector-icons
import React from 'react';
import { Text } from 'react-native';

const VectorIconsMock = React.forwardRef((props, ref) => (
  <Text ref={ref} {...props} />
));

VectorIconsMock.displayName = 'VectorIcons';

module.exports = VectorIconsMock;
