import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { EsimActivationPanel } from '../../src/components/domain/EsimActivationPanel';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Business Components/eSIM Activation Panel',
  component: EsimActivationPanel,
  parameters: {
    ...docsParameters({
      purpose: 'The scannable half of eSIM issuance, shown on the activation-complete screen once provisioning has happened: the QR code, the activation (LPA) string to key in by hand, and the instruction to scan it on the customer\'s device.',
      source: 'src/components/domain/EsimActivationPanel.tsx (activation codes come from `issueEsimProfile` in esimProfile.ts: `LPA:1$smdp.vodafone.qa$<16 characters>`)',
      states: ['One state: the QR code is always dark-on-light (`qr-frame`) so it stays scannable in dark theme; the surrounding card follows the theme.'],
      usage: ['Rendered only after payment and order submission/approval; the SIM step itself only records that an eSIM was selected.'],
      accessibility: ['The QR image has no text alternative of its own; the same value is available as text in the code chip, so nothing depends on the image.'],
      restrictions: ['The activation code is a mock GSMA SGP.22-style string, not a real SM-DP+ call.'],
    }),
  },
  argTypes: { activationCode: { control: 'text', description: 'The LPA activation string encoded in the QR and shown for manual entry.' } },
  args: { activationCode: 'LPA:1$smdp.vodafone.qa$K7M2Q9XDR4HTW8BN' },
  decorators: [(Story) => <div style={{ maxWidth: 360 }}><Story /></div>],
} satisfies Meta<typeof EsimActivationPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('LPA:1$smdp.vodafone.qa$K7M2Q9XDR4HTW8BN')).toBeInTheDocument();
  },
};
