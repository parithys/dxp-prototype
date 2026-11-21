import { createContext, useContext } from 'react';
import { CAF_LABELS, CAF_LANGUAGES, type CafContentDoc, type CafLabelKey, type CafLanguage } from '../../data/cafLanguage';

// What the signing screen reads in the language it is shown in: its labels and the business's documents for the language. Outside a provider it is the built-in English.

export interface CafContent {
  /** The business's document for the primary contact in the language, when provided. */
  primary?: CafContentDoc;
  /** The business's document for the secondary contact in the language, when provided. */
  secondary?: CafContentDoc;
}

export interface CafLanguageValue {
  lang: CafLanguage;
  dir: 'ltr' | 'rtl';
  content: CafContent;
  /** One of the screen's labels: the business's wording in the language, else the built-in English. */
  t: (key: CafLabelKey) => string;
}

export const cafLanguageValue = (lang: CafLanguage, content: CafContent = {}): CafLanguageValue => ({
  lang,
  dir: CAF_LANGUAGES.find((l) => l.key === lang)?.dir ?? 'ltr',
  content,
  t: (key) => content.primary?.labels?.[key] ?? content.secondary?.labels?.[key] ?? CAF_LABELS[key],
});

export const CafLanguageContext = createContext<CafLanguageValue>(cafLanguageValue('en'));

export const useCafLanguage = (): CafLanguageValue => useContext(CafLanguageContext);
