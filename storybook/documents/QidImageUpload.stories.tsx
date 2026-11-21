import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { QidImageUpload } from '../../src/components/domain/QidImageUpload';
import type { QidImageUploadProps, QidImageUploadValue } from '../../src/components/domain/qidImageUploadModel';
import { DemoScanVariantContext } from '../../src/components/domain/demoScanVariant';
import { docsParameters } from '../_shared/docs';
import { PNG_DATA_URL } from './fixtures';

/** Holds the capture the way a journey step does, so Initiate scan, Retake and Remove work when clicked. */
function Stateful(props: QidImageUploadProps) {
  const [value, setValue] = useState<QidImageUploadValue>(props.value);
  return (
    <QidImageUpload
      {...props}
      value={value}
      onChange={(v) => {
        setValue(v);
        props.onChange(v);
      }}
    />
  );
}

const SCANNED: QidImageUploadValue = { frontScanned: true, backScanned: true, source: 'scan', clear: true, captured: { name: 'Aisha Mohammed Al Naimi', dob: '14/03/1985', nationality: 'Qatari' } };

const meta = {
  title: 'Documents/Scan Identity Document (QID Image Upload)',
  component: QidImageUpload,
  parameters: {
    ...docsParameters({
      purpose: 'The Scan Identity Document card of Customer Verification: one reader pass reads both faces of the card (one Initiate scan, one Retake). Passport is two flatbed sections (see Passport Scan Sections). Value contract: a scan writes `frontScanned` and `backScanned` together.',
      source: 'src/components/domain/QidImageUpload.tsx (model: qidImageUploadModel.ts)',
      variants: ['Document types: QID, GCC ID, Diplomatic ID, Other ID (and Passport, which renders the Passport sections).', 'Card layouts through `variant`: `b2b2c`, `retired`, `mada` office ID cards.', 'Captured by the reader (`source: "scan"`) or as uploaded files (`source: "upload"`: Remove, Swap front and back).'],
      states: ['Empty: insert prompt with the scan frame.', 'Scanning (`Scanning QID`, spinner) - the simulated reader takes 0.9 s.', 'Scanned and clear: both faces side by side; the button becomes `Retake scan`, numbered once retakes complete.', 'Unclear (first pass of `blurFirstScan`): blurred capture with the `Image unclear` alert.', 'Scan refused (`onScan` returns false) / reader out of attempts (`canScan` false, `error` as `ScanFailureNotice`).', 'Uploaded: per-side Remove, Swap front and back, or Remove file for one file showing both sides.'],
      events: ['`onChange(value)` - every capture change (a retake first clears the old read).', '`onScan()` - once per pass, when it completes; return false to fail the pass.', '`onRetakeDone(shownCount, printed)` - a retake finished.', '`onDemoScan(type)` - demo only: simulate inserting a document type.', '`onVerify()` - Passport only.'],
      usage: ['This component only ever SCANS (on every device); uploading a supporting document belongs to Document Capture Actions. The reader\'s outcome is simulated by `SCAN_DURATION_MS`.', 'The `Demo only - simulate inserting` links and the DemoScanVariant link show only while demo content is on.'],
      accessibility: ['The scanning state is announced by the Spinner\'s label; unclear scans and failures are `role="alert"`; Remove buttons name their side.'],
      devices: ['Identical on Web and Tablet: the reader is offered on both.'],
    }),
  },
  argTypes: {
    documentType: { control: 'select', options: ['QID', 'GCC ID', 'Diplomatic ID', 'Other ID'], description: 'Which document is read; names the card and picks its artwork.' },
    variant: { control: 'select', options: [undefined, 'b2b2c', 'retired', 'mada'], description: 'Office ID card layout.' },
    canScan: { control: 'boolean', description: 'False once the attempt budget is spent: the Initiate button is dropped and the error is the instruction.' },
    blurFirstScan: { control: 'boolean', description: 'Demo: the first pass comes back unclear; retakes are clear.' },
    hideUnclearNotice: { control: 'boolean', description: 'Hides the "Image unclear" alert.' },
    error: { control: 'object', description: 'Shown in the insert zone after a failed scan: a string, or lines (a ScanFailureNotice).' },
    value: { control: 'object', description: 'The capture: frontScanned, backScanned, frontImage, backImage, source, combined, frontFile, backFile, clear ...' },
    identity: { control: 'object', description: 'Whose document the drawn capture shows.' },
    bothCaptureActions: { control: false },
    readerEverywhere: { control: false },
    onChange: { control: false },
    onScan: { control: false },
    onRetakeDone: { control: false },
    onDemoScan: { control: false },
    onVerify: { control: false },
  },
  args: { value: {}, onChange: fn(), onScan: fn(() => true), onRetakeDone: fn(), documentType: 'QID' },
  render: (args) => <Stateful {...args} />,
} satisfies Meta<typeof QidImageUpload>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Both sides of the QID are required for verification')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Initiate scan' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /Retake/ })).toBeNull();
  },
};

export const ScanThenRetake: Story = {
  name: 'Scanning and Retake (interactive)',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Initiate scan' }));
    await expect(await canvas.findByText('Scanning QID')).toBeVisible();
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Retake scan' })).toBeVisible(), { timeout: 3000 });
    await expect(args.onScan).toHaveBeenCalledTimes(1);
    await expect(canvas.getByText('QID front')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Retake scan' }));
    await expect(await canvas.findByText('Rescanning QID')).toBeVisible();
    await waitFor(() => expect(canvas.getByRole('button', { name: /Retake scan, 1 so far/ })).toBeVisible(), { timeout: 3000 });
    await expect(args.onRetakeDone).toHaveBeenCalledTimes(1);
  },
};

export const Scanned: Story = {
  args: { value: SCANNED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('QID front')).toBeVisible();
    await expect(canvas.getByText('QID back')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Retake scan' })).toBeVisible();
  },
};

export const UnclearScan: Story = {
  args: { value: { ...SCANNED, clear: false } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent('Image unclear');
  },
};

export const FirstPassBlurredThenClear: Story = {
  args: { blurFirstScan: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Initiate scan' }));
    await waitFor(() => expect(canvas.getByRole('alert')).toHaveTextContent('Image unclear'), { timeout: 3000 });
    await userEvent.click(canvas.getByRole('button', { name: 'Retake scan' }));
    await waitFor(() => expect(canvas.queryByRole('alert')).toBeNull(), { timeout: 3000 });
  },
};

export const ScanRefused: Story = {
  args: { onScan: fn(() => false), error: 'The reader could not read the document. Insert the card and try again.' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Initiate scan' }));
    await waitFor(() => expect(args.onScan).toHaveBeenCalled(), { timeout: 3000 });
    await expect(canvas.getByRole('alert')).toHaveTextContent('could not read');
    await expect(canvas.queryByRole('button', { name: /Retake/ })).toBeNull();
  },
};

export const AttemptsUsedUp: Story = {
  args: {
    canScan: false,
    error: ['We could not read the document after the permitted attempts.', 'Select the ID type and enter the number manually to continue.', 'Entering the number manually needs Store Manager approval.'],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Card Could Not Be Read')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Initiate scan' })).toBeNull();
    await expect(canvas.getByRole('alert')).toHaveTextContent('Store Manager approval');
  },
};

export const GccId: Story = { args: { documentType: 'GCC ID' } };
export const DiplomaticId: Story = { args: { documentType: 'Diplomatic ID', value: SCANNED } };
export const OfficeIdCardMada: Story = { args: { documentType: 'Other ID', variant: 'mada', value: SCANNED } };

export const UploadedPairWithRemove: Story = {
  args: { value: { frontScanned: true, backScanned: true, source: 'upload', clear: true, sidesSet: true, frontImage: PNG_DATA_URL, backImage: PNG_DATA_URL, frontFile: 'qid-front.png', backFile: 'qid-back.png' } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('QID front (qid-front.png)')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Swap front and back' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Remove the uploaded QID back file' }));
    await expect(args.onChange).toHaveBeenCalled();
    await waitFor(() => expect(canvas.getByText('QID back side needed')).toBeVisible());
  },
};

export const UploadedSingleFileBothSides: Story = {
  args: { value: { frontScanned: true, backScanned: true, source: 'upload', combined: true, clear: true, frontImage: PNG_DATA_URL, backImage: PNG_DATA_URL, frontFile: 'qid-both.png', backFile: 'qid-both.png' } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Remove the uploaded QID file' }));
  },
};

export const DemoOnlyInsertLinks: Story = {
  args: { demoTypes: [{ value: 'QID', label: 'Qatar ID' }, { value: 'GCC ID', label: 'GCC ID' }, { value: 'Diplomatic ID', label: 'Diplomatic ID' }], onDemoScan: fn() },
  play: async ({ canvasElement, args }) => {
    const link = within(canvasElement).queryByRole('button', { name: 'GCC ID' });
    // The links are demo-only: with NEXT_PUBLIC_SHOW_DEMO=false they are marked synthetic and hidden, so assert only when shown.
    if (link) {
      await userEvent.click(link);
      await expect(args.onDemoScan).toHaveBeenCalledWith('GCC ID');
    }
  },
};

export const DemoScanVariantLink: Story = {
  name: 'Demo scan variant (Scan Below 18)',
  decorators: [
    (Story) => (
      <DemoScanVariantContext.Provider value={{ label: 'Scan Below 18', onSelect: fn(), onStandard: fn() }}>
        <Story />
      </DemoScanVariantContext.Provider>
    ),
  ],
  parameters: { docs: { description: { story: 'A journey piece (the Secondary Contact) provides `DemoScanVariantContext`; the card then shows a demo-only link beside Initiate scan that makes the simulated reader present a different person. Shown only while demo content is on.' } } },
};
