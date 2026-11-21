#!/usr/bin/env python3
"""Turns the business's CAF documents into the configuration files the signing screen reads.

  reference/caf-content/CAF_<journey>_<party>_<language>.docx     (what the business provides)
  public/config/caf-content/CAF_<journey>_<party>_<language>.json (what this writes; what the app loads)

    journey   postpaid | prepaid
    party     primary | secondary
    language  english | arabic

e.g. CAF_postpaid_primary_english.docx, CAF_postpaid_primary_arabic.docx, CAF_postpaid_secondary_english.docx, CAF_postpaid_secondary_arabic.docx.

How a document is read (plain Word styles, nothing else is interpreted):
  * the paragraph in the Title style is the document's heading (e.g. "Key Terms & Conditions");
  * each paragraph in the Heading 1 style starts a section - its title; the paragraphs under it, up to the next Heading 1, are its wording;
  * a Heading 1 called "Labels" is followed by a two-column table: the label's key and its text (the keys are those of CAF_LABELS in src/data/cafLanguage.ts, parsed from
    there - an unknown key stops the build, so a typo never silently drops a label).

The Arabic document is its own text, never a translation of the English by this script or the app. A language with no document is simply not written; the app then shows
its built-in English.

  python3 reference/scripts/build_caf_content.py            # convert every document found
  python3 reference/scripts/build_caf_content.py --check    # verify only (exit 1 on a problem), writing nothing
  --source DIR / --out DIR                                  # other folders (the tests use them)
"""
import argparse, json, re, sys, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
NAME = re.compile(r'^CAF_(postpaid|prepaid)_(primary|secondary)_(english|arabic)\.docx$')
LANGUAGE_CODE = {'english': 'en', 'arabic': 'ar'}


def label_keys():
    text = (ROOT / 'src/data/cafLanguage.ts').read_text(encoding='utf8')
    block = text[text.index('export const CAF_LABELS = {'):text.index('} as const;', text.index('export const CAF_LABELS = {'))]
    return set(re.findall(r'^\s{2}(\w+):', block, re.M))


def para_text(p):
    return ''.join(t.text or '' for t in p.iter(W + 't')).strip()


def para_style(p):
    s = p.find(f'{W}pPr/{W}pStyle')
    return (s.get(W + 'val') if s is not None else '').lower().replace(' ', '')


def read_docx(path):
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read('word/document.xml'))
    body = root.find(W + 'body')
    heading, sections, labels, current, in_labels = None, [], {}, None, False
    for el in body:
        if el.tag == W + 'p':
            text, style = para_text(el), para_style(el)
            if not text:
                continue
            if style == 'title':
                heading = text
            elif style in ('heading1', 'heading 1'):
                in_labels = text.lower() == 'labels'
                current = None if in_labels else {'title': text, 'parts': []}
                if current:
                    sections.append(current)
            elif current is not None:
                current['parts'].append(text)
        elif el.tag == W + 'tbl' and in_labels:
            for tr in el.iter(W + 'tr'):
                cells = [' '.join(para_text(p) for p in tc.iter(W + 'p')).strip() for tc in tr.iter(W + 'tc')]
                if len(cells) >= 2 and cells[0] and cells[1]:
                    labels[cells[0]] = cells[1]
    return heading, [{'title': s['title'], 'body': ' '.join(s['parts'])} for s in sections], labels


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--source', default=str(ROOT / 'reference/caf-content'))
    ap.add_argument('--out', default=str(ROOT / 'public/config/caf-content'))
    ap.add_argument('--check', action='store_true')
    args = ap.parse_args()
    source, out = Path(args.source), Path(args.out)
    keys = label_keys()
    problems, written = [], 0
    for path in sorted(source.glob('*.docx')):
        if path.name.startswith('~$'):
            continue
        m = NAME.match(path.name)
        if not m:
            problems.append(f'{path.name}: not named CAF_<postpaid|prepaid>_<primary|secondary>_<english|arabic>.docx')
            continue
        journey, party, language = m.groups()
        heading, sections, labels = read_docx(path)
        unknown = sorted(set(labels) - keys)
        if unknown:
            problems.append(f'{path.name}: unknown label key(s) {", ".join(unknown)} (valid: CAF_LABELS in src/data/cafLanguage.ts)')
            continue
        if not heading and not sections and not labels:
            problems.append(f'{path.name}: nothing to read (a Title, Heading 1 sections or a Labels table)')
            continue
        doc = {'journey': journey, 'party': party, 'language': LANGUAGE_CODE[language], 'source': path.name,
               **({'heading': heading} if heading else {}), **({'sections': sections} if sections else {}), **({'labels': labels} if labels else {})}
        if not args.check:
            out.mkdir(parents=True, exist_ok=True)
            (out / path.name.replace('.docx', '.json')).write_text(json.dumps(doc, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
        written += 1
        print(f'  {path.name}: {"heading, " if heading else ""}{len(sections)} section(s), {len(labels)} label(s)')
    for p in problems:
        print('PROBLEM', p, file=sys.stderr)
    print(f'{"checked" if args.check else "wrote"} {written} document(s)' + (f', {len(problems)} problem(s)' if problems else ''))
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
