import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import i18n from '../services/i18n';

/**
 * LanguageSynchronizer
 *
 * This component synchronizes the i18n language with the Redux store.
 * It must be placed inside the Redux Provider and PersistGate to ensure
 * the store is rehydrated before syncing the language.
 *
 * This solves the issue where the language selection (e.g., Vietnamese)
 * is not persisted across app restarts because i18n initializes before
 * Redux store rehydration completes.
 */
const LanguageSynchronizer: React.FC = () => {
  const language = useSelector((state: RootState) => state.settings.language);

  useEffect(() => {
    // Only change language if it differs from current i18n language
    if (language && language !== i18n.language) {
      console.log(
        `🌍 [LanguageSynchronizer] Syncing i18n language to: ${language} (was: ${i18n.language})`,
      );
      i18n.changeLanguage(language);
    }
  }, [language]);

  return null; // This component doesn't render anything
};

export default LanguageSynchronizer;
