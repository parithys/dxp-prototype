import type { ReactNode } from 'react';
import { TabStrip } from 'dxp-ui';
import { CAF_LABELS, CAF_LANGUAGES, type CafLanguage } from '../../data/cafLanguage';
import { CafLanguageContext, cafLanguageValue, type CafContent } from './cafLanguageContext';

/** Sets the language and the business's content for what is inside. `direction`: the content is laid out in the language's direction (Arabic right to left) - the customer's pop-up. */
export function CafLanguageProvider({ lang, content, direction = false, children }: { lang: CafLanguage; content?: CafContent; direction?: boolean; children: ReactNode }) {
  const value = cafLanguageValue(lang, content);
  return (
    <CafLanguageContext.Provider value={value}>
      {direction ? (
        <div dir={value.dir} lang={lang}>
          {children}
        </div>
      ) : (
        children
      )}
    </CafLanguageContext.Provider>
  );
}

/** English / العربية, the customer's choice of the language to read and sign in. */
export function CafLanguageToggle({ lang, onChange }: { lang: CafLanguage; onChange: (lang: CafLanguage) => void }) {
  return (
    <div dir="ltr">
      <TabStrip variant="filter" label={CAF_LABELS.language} items={CAF_LANGUAGES.map((l) => ({ key: l.key, label: l.label }))} active={lang} onChange={onChange} />
    </div>
  );
}
