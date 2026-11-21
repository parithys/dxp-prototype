import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { Button, Icon, SCAN_CORNERS } from 'dxp-ui';
import { IdFileUpload } from '../../src/components/domain/IdFileUpload';
import { docsParameters } from '../_shared/docs';
import { SideBySide, Specimen } from '../_shared/layout';

const scanButton = (
  <Button size="sm" className="shrink-0">
    <Icon path={SCAN_CORNERS} className="size-4 " />
    Initiate scan
  </Button>
);

const meta = {
  title: 'Documents/ID File Upload',
  component: IdFileUpload,
  parameters: {
    ...docsParameters({
      purpose: 'The capture actions row of the Scan Identity Document component: it hosts the reader button (`leading`) and, where the rules allow, an upload that checks the file(s) (type, size), reads them and hands over an `IdUploadResult` (`pair`, `both`, `front` or `back`).',
      source: 'src/components/domain/IdFileUpload.tsx',
      variants: ['Whole document (no `side`): two files are front then back; one file asks "what does this show?" (Front and Back, Front Only, Back Only).', 'One side (`side="front"` or `"back"`): one file for that side.', '`align="end"` puts the note and problems at the end of the row.'],
      states: ['Reader button only (the shape below).', 'Disabled while a scan runs.', 'Problem (`role="alert"`) for a wrong type, empty or oversize file, or too many files.'],
      events: ['`onUpload(result)` - `{ sides, files: [{ name, image }] }`.'],
      usage: ['Which actions are offered is decided by `idCaptureOptions()` (idUploadModel.ts): on the web the reader (`leading`) and no upload (unless `bothActions`); on a tablet never the reader - `Open Camera` and `Upload document` instead, a camera photo being taken as a one-file upload.'],
      accessibility: ['The hidden file input is `aria-hidden` and not in the tab order; the visible buttons are the interface.'],
      devices: ['Web: the reader button, no upload. Tablet: Open Camera and Upload document, no reader.'],
      restrictions: ['On the web the upload is reached only where a step asks for `bothActions` (the Customer Representative ID).'],
    }),
  },
  argTypes: {
    label: { control: 'text', description: 'The upload button\'s label.' },
    side: { control: 'inline-radio', options: [undefined, 'front', 'back'], description: 'One side only; absent: the whole document.' },
    disabled: { control: 'boolean', description: 'Disables the buttons (a scan is running).' },
    align: { control: 'inline-radio', options: ['center', 'end'], description: 'Where the note and problems sit under the buttons.' },
    scanner: { control: 'boolean', description: 'The reader is offered at this step (defaults to whether `leading` is given).' },
    bothActions: { control: 'boolean', description: 'Offer reader and upload on every device (no effect today, see Restrictions).' },
    readerEverywhere: { control: 'boolean', description: 'Keep the reader on a tablet (no effect today).' },
    leading: { control: false },
    onUpload: { control: false },
  },
  args: { onUpload: fn(), leading: scanButton },
} satisfies Meta<typeof IdFileUpload>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Web: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Initiate scan' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /upload/i })).toBeNull();
  },
};
export const Tablet: Story = {
  tags: ['tablet'], globals: { device: 'tablet' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: 'Initiate scan' })).toBeNull();
    await expect(canvas.getByRole('button', { name: 'Open Camera' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: /upload document/i })).toBeVisible();
  },
};
export const AlignedToTheEnd: Story = { args: { align: 'end' } };
export const Disabled: Story = { args: { disabled: true } };
export const NoReader: Story = {
  args: { leading: undefined },
  parameters: { docs: { description: { story: 'Without a reader and with no upload offered the row is empty: this is the state the Restrictions note describes.' } } },
};
export const Comparison: Story = {
  render: (args) => (
    <SideBySide>
      <Specimen label="Whole document">
        <IdFileUpload {...args} />
      </Specimen>
      <Specimen label="One side (front)">
        <IdFileUpload {...args} side="front" label="Upload front side" />
      </Specimen>
    </SideBySide>
  ),
};
