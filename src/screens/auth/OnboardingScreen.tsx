import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { useTheme } from '../../contexts/ThemeContext';

type OnboardingScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'Onboarding'
>;

export const OnboardingScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingScreenNavigationProp>();
  const { theme } = useTheme();

  // Animation values for each element
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(30)).current;

  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(30)).current;

  const descriptionOpacity = useRef(new Animated.Value(0)).current;
  const descriptionTranslateY = useRef(new Animated.Value(30)).current;

  const feature1Opacity = useRef(new Animated.Value(0)).current;
  const feature1TranslateY = useRef(new Animated.Value(30)).current;

  const feature2Opacity = useRef(new Animated.Value(0)).current;
  const feature2TranslateY = useRef(new Animated.Value(30)).current;

  const feature3Opacity = useRef(new Animated.Value(0)).current;
  const feature3TranslateY = useRef(new Animated.Value(30)).current;

  const feature4Opacity = useRef(new Animated.Value(0)).current;
  const feature4TranslateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Create staggered animations for each element
    const animateElement = (
      opacity: Animated.Value,
      translateY: Animated.Value,
      delay: number,
    ) => {
      return Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 600,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 600,
          delay,
          useNativeDriver: true,
        }),
      ]);
    };

    // Start animations with staggered delays
    Animated.stagger(200, [
      animateElement(titleOpacity, titleTranslateY, 0),
      animateElement(subtitleOpacity, subtitleTranslateY, 0),
      animateElement(descriptionOpacity, descriptionTranslateY, 0),
      animateElement(feature1Opacity, feature1TranslateY, 0),
      animateElement(feature2Opacity, feature2TranslateY, 0),
      animateElement(feature3Opacity, feature3TranslateY, 0),
      animateElement(feature4Opacity, feature4TranslateY, 0),
    ]).start();

    // Auto-navigate to Login after 5 seconds
    const timer = setTimeout(() => {
      navigation.navigate('Login');
    }, 4000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.content}>
        <Animated.Text
          style={[
            styles.title,
            { color: theme.text },
            {
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
            },
          ]}
        >
          PasswordEpic
        </Animated.Text>

        <Animated.Text
          style={[
            styles.subtitle,
            { color: theme.textSecondary },
            {
              opacity: subtitleOpacity,
              transform: [{ translateY: subtitleTranslateY }],
            },
          ]}
        >
          Ultra-Secure Mobile Password Manager
        </Animated.Text>

        <Animated.Text
          style={[
            styles.description,
            { color: theme.textSecondary },
            {
              opacity: descriptionOpacity,
              transform: [{ translateY: descriptionTranslateY }],
            },
          ]}
        >
          Protect your digital life with military-grade encryption and seamless
          auto-fill functionality.
        </Animated.Text>

        <View style={styles.features}>
          <Animated.Text
            style={[
              styles.feature,
              { color: theme.text },
              {
                opacity: feature1Opacity,
                transform: [{ translateY: feature1TranslateY }],
              },
            ]}
          >
            🔐 Zero-Knowledge Architecture
          </Animated.Text>

          <Animated.Text
            style={[
              styles.feature,
              { color: theme.text },
              {
                opacity: feature2Opacity,
                transform: [{ translateY: feature2TranslateY }],
              },
            ]}
          >
            🛡️ Biometric Authentication
          </Animated.Text>

          <Animated.Text
            style={[
              styles.feature,
              { color: theme.text },
              {
                opacity: feature3Opacity,
                transform: [{ translateY: feature3TranslateY }],
              },
            ]}
          >
            ⚡ Secure Auto-fill
          </Animated.Text>

          <Animated.Text
            style={[
              styles.feature,
              { color: theme.text },
              {
                opacity: feature4Opacity,
                transform: [{ translateY: feature4TranslateY }],
              },
            ]}
          >
            🔒 End-to-End Encryption
          </Animated.Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 48,
  },
  features: {
    alignSelf: 'stretch',
    marginBottom: 48,
  },
  feature: {
    fontSize: 16,
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  button: {
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});
