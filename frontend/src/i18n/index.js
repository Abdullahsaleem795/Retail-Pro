import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import ur from './ur.json';

const STORAGE_KEY = 'retailpro_language';

export const getStoredLanguage = () => localStorage.getItem(STORAGE_KEY) || 'en';

// Urdu is right-to-left; flip the document direction so tables, sidebars and
// form layouts mirror correctly instead of just swapping the text.
export const applyDirection = (language) => {
  const dir = language === 'ur' ? 'rtl' : 'ltr';
  document.documentElement.setAttribute('dir', dir);
  document.documentElement.setAttribute('lang', language);
};

export const changeLanguage = (language) => {
  localStorage.setItem(STORAGE_KEY, language);
  i18n.changeLanguage(language);
  applyDirection(language);
};

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ur: { translation: ur },
  },
  lng: getStoredLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

applyDirection(getStoredLanguage());

export default i18n;
