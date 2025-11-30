import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { findBestLanguageTag, getLocales } from 'react-native-localize';

import en from '../locales/en.json';
import vi from '../locales/vi.json';

const resources = {
  en: {
    translation: en,
  },
  vi: {
    translation: vi,
  },
};

const languageDetector = {
  type: 'languageDetector',
  async: true,
  detect: (
    callback: (lang: string | readonly string[] | undefined) => void,
  ) => {
    try {
      // Thử dùng findBestLanguageTag trước (API mới trong v3.x)
      const bestLanguage = findBestLanguageTag(Object.keys(resources));
      if (bestLanguage?.languageTag) {
        callback(bestLanguage.languageTag);
        return;
      }

      // Fallback: lấy từ device locales
      const locales = getLocales();
      if (locales && locales.length > 0) {
        const deviceLang = locales[0].languageCode;
        // Kiểm tra xem ngôn ngữ có được hỗ trợ không
        if (Object.keys(resources).includes(deviceLang)) {
          callback(deviceLang);
          return;
        }
      }

      // Default to English
      callback('en');
    } catch (error) {
      console.warn('Language detection failed, defaulting to English:', error);
      callback('en');
    }
  },
  init: () => {},
  cacheUserLanguage: () => {},
};

i18n
  // @ts-ignore
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    resources,
    interpolation: {
      escapeValue: false, // React already protects from xss
    },
    compatibilityJSON: 'v4', // Updated for i18next v23+
  });

export default i18n;
