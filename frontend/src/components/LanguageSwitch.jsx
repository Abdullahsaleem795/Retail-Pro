import { useState } from 'react';
import { changeLanguage, getStoredLanguage } from '../i18n';
import './LanguageSwitch.css';

export default function LanguageSwitch() {
  const [language, setLanguage] = useState(getStoredLanguage);

  const handleSwitch = (lang) => {
    setLanguage(lang);
    changeLanguage(lang);
  };

  return (
    <div className="lang-switch">
      <button
        className={language === 'en' ? 'lang-btn lang-btn-active' : 'lang-btn'}
        onClick={() => handleSwitch('en')}
      >
        EN
      </button>
      <button
        className={language === 'ur' ? 'lang-btn lang-btn-active' : 'lang-btn'}
        onClick={() => handleSwitch('ur')}
      >
        اردو
      </button>
    </div>
  );
}
