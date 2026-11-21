import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { MultiSimPanel } from '../../src/components/domain/MultiSimPanel';
import type { SimTypeValue } from '../../src/components/domain/SimTypeStep';
import { docsParameters } from '../_shared/docs';

const PHYSICAL: SimTypeValue = { simType: 'Physical', simSerial: '8974412345678901234', simValid: true, simIccid: '8974412345678901234', simStockStatus: 'Available', simKind: 'Physical' };
const ESIM: SimTypeValue = { simType: 'eSIM', esimIssued: true, esimActivationCode: 'LPA:1$smdp.vodafone.qa$ABCD2345EFGH6789', simIccid: '8974412009900140101' };

const meta = {
  title: 'Business Components/Multi-SIM Panel',
  component: MultiSimPanel,
  render: (args) => (
    <div style={{ maxWidth: 900 }}>
      <MultiSimPanel {...args} />
    </div>
  ),
  parameters: {
    ...docsParameters({
      purpose: 'The order\'s Multi-SIMs on the SIM Selection page, read-only. Each SIM\'s type (Physical SIM or eSIM) and serial number were decided when the Multi SIM add-on was configured on the Addons page, so nothing is chosen, scanned or generated here.',
      source: 'src/components/domain/MultiSimPanel.tsx',
      variants: ['`count`: how many Multi-SIMs the order provisions.', '`value`: the SIMs selected so far, in order.', ],
      states: ['All selected (SIM Type, SIM Serial Number per SIM, no number); Partly selected (a SIM not yet selected says where to select it).'],
      events: ['None: the panel only displays. SIMs are selected, changed and removed in the Multi SIM drawer on the Addons page.'],
      validation: ['None here: the step\'s Continue waits until every Multi-SIM is selected and no serial repeats.'],
      accessibility: ['The SIMs are a list labelled "Multi-SIMs"; each is named "Multi SIM n".'],
      restrictions: ['A Multi-SIM has no number of its own: it shares the Primary SIM\'s MSISDN, so none is shown.'],
      devices: ['Layout only; no device-specific behaviour.'],
    }),
  },
  argTypes: {
    count: { control: { type: 'number', min: 1, max: 4 }, description: 'How many Multi-SIMs the order provisions.' },
    value: { control: 'object', description: 'The SIMs selected so far.' },
  },
  args: { count: 2, value: [PHYSICAL, ESIM] },
} satisfies Meta<typeof MultiSimPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PartlySelected: Story = { args: { count: 3, value: [PHYSICAL] } };

/** The serial of an eSIM is its ICCID; no mobile number is shown. */
export const ShowsTypeSerialAndSharedNumber: Story = {
  args: { count: 1, value: [ESIM] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('eSIM')).toBeInTheDocument();
    await expect(canvas.getByText('8974412009900140101')).toBeInTheDocument();
    await expect(canvas.queryByText(/Mobile Number/)).toBeNull();
    await expect(canvas.queryByRole('button')).toBeNull();
  },
};
