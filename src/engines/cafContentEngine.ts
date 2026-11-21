import { loadConfigFile } from './configEngine';
import { cafContentName, type CafContentDoc, type CafJourney, type CafLanguage, type CafParty } from '../data/cafLanguage';

// The business's CAF documents (data/cafLanguage.ts), converted to configuration files in public/config/caf-content/. Read on demand, once each. A document that has not been
// provided (no file) is not an error: it is simply absent, and the screen shows its built-in English.

const cache = new Map<string, Promise<CafContentDoc | undefined>>();

/** The business's document for the journey, party and language, or undefined where it has not been provided. */
export function loadCafContent(journey: CafJourney, party: CafParty, language: CafLanguage): Promise<CafContentDoc | undefined> {
  const name = cafContentName(journey, party, language);
  let doc = cache.get(name);
  if (!doc) {
    doc = loadConfigFile<CafContentDoc>(`caf-content/${name}.json`).then(
      (d) => (d && typeof d === 'object' ? d : undefined),
      () => undefined,
    );
    cache.set(name, doc);
  }
  return doc;
}
