import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .use({
    type: 'backend',
    read: (language: string, _namespace: string, callback: (error: any, resources: any) => void) => {
      // Dynamic import for locales to enable code splitting
      import(`./locales/${language}.json`)
        .then((resources) => {
          callback(null, resources.default || resources);
        })
        .catch((error) => {
          callback(error, null);
        });
    }
  })
  .init({
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // react already safes from xss
    },
    detection: {
      order: ['querystring', 'cookie', 'localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage', 'cookie']
    }
  });

export default i18n;