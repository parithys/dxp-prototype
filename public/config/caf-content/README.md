# CAF content - provided by the business

Drop the business's Customer Application Form documents here, one per journey, party and language, named exactly:

| File | What it is |
|---|---|
| `CAF_postpaid_primary_english.docx`   | Postpaid, primary contact, English |
| `CAF_postpaid_primary_arabic.docx`    | Postpaid, primary contact, Arabic |
| `CAF_postpaid_secondary_english.docx` | Postpaid, secondary contact (Supplementary Form), English |
| `CAF_postpaid_secondary_arabic.docx`  | Postpaid, secondary contact (Supplementary Form), Arabic |
| `CAF_prepaid_primary_english.docx` ... | Prepaid, same pattern |

The Arabic is its own document from the business - it is not a translation of the English, and nothing in the app translates anything.

## How to write a document

Use plain Word styles; nothing else is interpreted.

- **Title** - the document's heading, e.g. *Key Terms & Conditions*.
- **Heading 1** - one per section (its title). The paragraphs under it, up to the next Heading 1, are the section's wording.
- A **Heading 1 called `Labels`**, followed by a two-column table: the label's key and its text. The keys are those of `CAF_LABELS` in `src/data/cafLanguage.ts`
  (for example `primaryContact`, `secondaryContact`, `keyInformation`, `pleaseSign`, `save`, `clear`, `marketing`, `understandCopy`, ...). An unknown key stops the build.

## Turn them into configuration

```
npm run sync:caf-content          # writes public/config/caf-content/*.json
npm run verify:caf-content        # checks the documents, writes nothing
```

The signing screen reads `public/config/caf-content/CAF_<journey>_<party>_<language>.json`. Where a document has not been provided the screen shows its built-in English, so a
language can be added one document at a time. The customer chooses English or Arabic in their pop-up (Customer view); the agent's screen reads the English documents.

## Demo stand-ins

Until the business's Arabic documents arrive, `public/config/caf-content/CAF_postpaid_primary_arabic.json` and `CAF_postpaid_secondary_arabic.json` hold a DEMO translation of the
built-in English terms (marked `"demo": true`). They are not produced by the converter: when the business's real `CAF_postpaid_*_arabic.docx` is converted, the file with the
same name is overwritten and the demo is gone.
