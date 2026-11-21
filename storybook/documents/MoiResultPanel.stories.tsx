import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { MoiResultPanel } from '../../src/components/patterns/MoiResultPanel';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Documents/MOI Result Panel',
  component: MoiResultPanel,
  parameters: {
    ...docsParameters({
      purpose: 'The MOI-validated Identity Details shown after an ID is read, for every journey that identifies a customer by ID without collecting contact details (Passport-to-QID, SIM Swap, Pre-to-Post, Prepaid ...). The same card and facts as the Contact step of New Connection.',
      source: 'src/components/patterns/MoiResultPanel.tsx',
      variants: ['Document type shown (default) or hidden when the journey already chose it (`hideDocumentType`).', 'With or without the looked-up ID number (`idNumber`, listed read-only).'],
      states: ['Validated: `statusText` carries the MOI validation time.'],
      usage: ['Read-only: the identity comes from the registry (MOI), it is never edited here.'],
    }),
  },
  argTypes: {
    idType: { control: 'select', options: ['QID', 'Passport', 'GCC ID', 'Diplomatic ID', 'Other ID'], description: 'The ID type that was looked up.' },
    hideDocumentType: { control: 'boolean', description: 'The agent already chose the document type in this journey, so it is not repeated.' },
    idNumber: { control: 'text', description: 'The ID number that was looked up.' },
    statusText: { control: 'text', description: 'e.g. "MOI validated at 07/10/2026, 06:14:30".' },
    moiResult: { control: 'object', description: 'The registry result: name, dob (ISO), nationality, gender, expiryDate ...' },
  },
  args: {
    moiResult: { name: 'Aisha Mohammed Al Naimi', dob: '1985-03-14', nationality: 'Qatari', gender: 'Female', expiryDate: '2030-06-20' },
    idType: 'QID',
    idNumber: '29850123456',
    statusText: 'MOI validated at 07/10/2026, 06:14:30',
  },
  decorators: [(Story) => <div style={{ maxWidth: 720 }}><Story /></div>],
} satisfies Meta<typeof MoiResultPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/MOI validated at/)).toBeVisible();
    // The name is shown as separate fields (first, middle, last).
    await expect(within(canvasElement).getByText('Aisha')).toBeVisible();
    await expect(within(canvasElement).getByText('Mohammed Al')).toBeVisible();
    await expect(within(canvasElement).getByText('Naimi')).toBeVisible();
  },
};
export const DocumentTypeHidden: Story = { args: { hideDocumentType: true } };
export const Passport: Story = { args: { idType: 'Passport', idNumber: 'P0998812' } };
export const WithoutIdNumber: Story = { args: { idNumber: undefined } };
