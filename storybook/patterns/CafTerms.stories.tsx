import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { FullTerms } from '../../src/components/patterns/CafTerms';
import { CafLanguageProvider, CafLanguageToggle } from '../../src/components/patterns/cafLanguage';
import type { CafContent } from '../../src/components/patterns/cafLanguageContext';
import type { CafLanguage } from '../../src/data/cafLanguage';
import { loadCafContent } from '../../src/engines/cafContentEngine';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Patterns/CAF Terms & Conditions',
  component: FullTerms,
  parameters: {
    ...docsParameters({
      purpose: 'The complete Terms & Conditions, in their own bordered panel directly above the signature block, so the customer can read all of it before signing. The terms sit in a dedicated container of one FIXED height: more content scrolls inside it and never grows it or moves the page; the contact line stays under it, outside the scrolling. Part of "CAF & Signature".',
      source: 'src/components/patterns/CafTerms.tsx, cafLanguage.tsx, cafLanguageContext.ts',
      variants: ['Single panel: Key Terms & Conditions (postpaid) or Prepaid Terms & Conditions (`journey="prepaid"`).', 'With a Secondary Contact: `supplementaryTerms` puts the general and Supplementary terms in two cards, each closing with its contact.', 'Prepaid iPAY: `ipay` adds the Yes / No toggle and, while Yes, the iPAY terms in a second column.', 'Signed: the terms collapse to one line each above the signature.', 'English / Arabic: `CafLanguageProvider lang="ar"` with the business\'s own Arabic document (`public/config/caf-content/`), laid out right to left with `direction`.'],
      states: ['Unsigned (scrollable fixed-height terms)', 'Signed (condensed)', 'Terms not loaded / not enabled: only the children (the form) render'],
      usage: ['The language choice (English / العربية) exists only in the customer\'s pop-up (Customer view, `?mirror=1`); the agent\'s screen is always English. Nothing Arabic is written or translated in the app: the wording is the business\'s document for the language, and the built-in English shows where none is provided.', 'The terms region is focusable (`tabIndex=0`, `role="region"`, labelled by its heading) so it can be scrolled with the keyboard.'],
      accessibility: ['Each scrolling terms container is a labelled region reachable by Tab; headings and bodies use `dir="auto"` so each paragraph takes its own reading direction.'],
    }),
  },
  argTypes: { enabled: { control: 'boolean', description: 'Show the terms (false: only the children).' }, signed: { control: 'boolean', description: 'The CAF is signed: condensed view.' }, journey: { control: 'select', options: ['postpaid', 'prepaid'], description: 'Whose terms.' }, children: { control: false } },
  args: { enabled: true, signed: false, journey: 'postpaid' },
} satisfies Meta<typeof FullTerms>;
export default meta;
type Story = StoryObj<typeof FullTerms>;

const Below = () => <p className="caption-muted">(The agreements and the signature sit here, below the terms.)</p>;

export const Default: Story = {
  render: (args) => (
    <FullTerms enabled={args.enabled} signed={args.signed} journey={args.journey}>
      <Below />
    </FullTerms>
  ),
  play: async ({ canvasElement }) => {
    const region = await within(canvasElement).findByRole('region', { name: 'Key Terms & Conditions' });
    // One fixed height: the terms scroll inside it.
    await expect(getComputedStyle(region).overflowY).toBe('scroll');
  },
};

export const Prepaid: Story = { args: { journey: 'prepaid' }, render: Default.render };
export const Signed: Story = { args: { signed: true }, render: Default.render };
export const Disabled: Story = { args: { enabled: false }, render: Default.render };

export const WithSecondaryContact: Story = {
  render: () => (
    <FullTerms enabled journey="postpaid" supplementaryTerms={{ terms: [{ title: 'Supplementary terms', body: 'The secondary contact uses the line under the primary contact\'s account.' }], primaryContactName: 'Ahmed Al-Sulaiti', secondaryContactName: 'Sample Secondary' }}>
      <Below />
    </FullTerms>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('region', { name: 'Key Terms & Conditions' })).toBeInTheDocument();
    await expect(canvas.getByRole('region', { name: 'Supplementary Key Terms & Conditions' })).toBeInTheDocument();
  },
};

function Bilingual({ initial = 'en' }: { initial?: CafLanguage }) {
  const [lang, setLang] = useState<CafLanguage>(initial);
  const [content, setContent] = useState<CafContent>({});
  useEffect(() => {
    let live = true;
    void Promise.all([loadCafContent('postpaid', 'primary', lang), loadCafContent('postpaid', 'secondary', lang)]).then(([primary, secondary]) => live && setContent({ primary, secondary }));
    return () => void (live = false);
  }, [lang]);
  return (
    <div className="stack gap-4">
      <CafLanguageToggle lang={lang} onChange={setLang} />
      <CafLanguageProvider lang={lang} content={lang === 'en' ? {} : content} direction>
        <FullTerms enabled journey="postpaid">
          <Below />
        </FullTerms>
      </CafLanguageProvider>
    </div>
  );
}

/** The customer's English / Arabic toggle on the terms. Arabic loads the business's own document (`CAF_postpaid_primary_arabic`) and lays the content out right to left. */
export const EnglishArabicToggle: Story = {
  render: () => <Bilingual />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvasElement.querySelector('[dir="rtl"]')).toBeNull();
    await userEvent.click(await canvas.findByRole('tab', { name: 'العربية' }));
    await waitFor(() => expect(canvasElement.querySelector('[dir="rtl"][lang="ar"]')).not.toBeNull());
    await userEvent.click(canvas.getByRole('tab', { name: 'English' }));
    await waitFor(() => expect(canvasElement.querySelector('[dir="rtl"]')).toBeNull());
  },
};
export const Arabic: Story = { render: () => <Bilingual initial="ar" /> };
