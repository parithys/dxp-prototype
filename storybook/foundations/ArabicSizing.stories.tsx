import type { Meta, StoryObj } from '@storybook/react-vite';
import { docsParameters } from '../_shared/docs';
import { Section } from '../_shared/layout';

function ArabicSizing() {
  return (
    <div className="stack gap-3">
      <p className="body-text">
        The only <code className="code-chip">:lang(ar)</code> rule in the stylesheets is in <code className="code-chip">src/ui-components.css</code>: Arabic wording inside a
        <code className="code-chip">.caf-terms-scroll</code> container (the CAF and signature terms) is set at <code className="code-chip">--fs-body</code> (16px), one step up from
        the 14px caption size the English terms use. Elsewhere Arabic text takes the same text-role classes as English; set <code className="code-chip">lang=&quot;ar&quot;</code> and
        <code className="code-chip">dir=&quot;rtl&quot;</code> on the element.
      </p>
      <div className="grid-2-up items-start">
        <div className="card pad-panel stack gap-2"><p className="eyebrow">English terms</p><div className="caf-terms-scroll stack"><p className="caption-secondary">I confirm that the details provided are correct.</p></div></div>
        <div className="card pad-panel stack gap-2"><p className="eyebrow">Arabic terms (lang=&quot;ar&quot;)</p><div lang="ar" dir="rtl" className="caf-terms-scroll stack"><p>أؤكد أن البيانات المقدمة صحيحة.</p></div></div>
      </div>
    </div>
  );
}

const meta = {
  title: 'Foundations/Arabic Sizing',
  parameters: {
    ...docsParameters({
      purpose: 'How Arabic wording is sized inside the CAF and signature terms container.',
      source: 'src/app-components.css (.caf-terms-scroll, :lang(ar))',
    }),
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Arabic: Story = { name: 'Arabic sizing', render: () => <Section title="Arabic (:lang(ar))"><ArabicSizing /></Section> };
