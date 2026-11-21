import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { IdScannerPanel } from '../../src/components/patterns/IdScannerPanel';
import type { IdLookupValue } from '../../src/components/patterns/idLookupModel';
import { docsParameters } from '../_shared/docs';

type Props = Parameters<typeof IdScannerPanel>[0];

/** The lookup step owns the value and a `latest` ref of it; this stands in for that step. */
function Stateful(props: Props) {
  const [value, setValue] = useState<IdLookupValue>(props.value);
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  });
  return (
    <IdScannerPanel
      {...props}
      value={value}
      latest={latest}
      onChange={(v) => {
        setValue(v);
        props.onChange(v);
      }}
    />
  );
}

const meta = {
  title: 'Documents/ID Scanner Panel',
  component: IdScannerPanel,
  parameters: {
    ...docsParameters({
      purpose: 'The scanner section of the ID lookup: the document being read (or why there is none), the two-face capture, and the retake / fallback behaviour around it. Shown only when the selected document type can be scanned. It owns no state: everything the lookup step tracks comes in as props.',
      source: 'src/components/patterns/IdScannerPanel.tsx',
      variants: ['Scan-first flow (`autoDetectIdType`): demo document links and a blurred first pass.', 'Selector-led flow: no demo links, a clear scan.', 'The customer-bound journey (`contextNoDocument`, `contextHeldTypes`, `contextIdentity`): the customer\'s own card is shown, or the reason there is none.'],
      states: ['Empty scanner', 'Document detected (an ID number is on the value)', 'No document on file for the customer', 'Attempt budget spent: the failure notice replaces Initiate scan', 'Manual entry notice (journey rule text from the caller)'],
      events: ['`onChange(value)`, `handleScanAttempt()` (return false to fail a pass), `handleRetakeDone`, `handleDemoScan`, `onVerify` (Passport on web), `setNotFound`, `clearReconciliation`.'],
      usage: ['A retake discards the number and MOI result extracted from the previous read - the screen never claims a validated identity while the reader is re-reading.', 'The shared panel states no journey rule of its own: `manualEntryNotice` carries the journey\'s.'],
    }),
  },
  argTypes: {
    idType: { control: 'select', options: ['QID', 'Passport', 'GCC ID', 'Diplomatic ID'], description: 'The selected ID type.' },
    verifyThenFetch: { control: 'boolean', description: 'Hides the "Document detected" line and the unclear notice (the journey validates on request).' },
    autoDetectIdType: { control: 'boolean', description: 'The scan-first flow: demo links and a blurred first pass.' },
    scanBudgetSpent: { control: 'boolean', description: 'The scan attempts are used up.' },
    scanComplete: { control: 'boolean', description: 'Both faces are captured and the number extracted.' },
    contextNoDocument: { control: 'text', description: 'The customer the journey is bound to has no document to read (their name).' },
    contextHeldTypes: { control: 'object', description: 'ID types the customer does hold.' },
    manualEntryNotice: { control: 'text', description: 'What typing the ID by hand means in this journey.' },
    verifying: { control: 'boolean', description: 'Passport validation running.' },
    verifyDisabled: { control: 'boolean', description: 'Disables validation.' },
    value: { control: 'object', description: 'The lookup value (idNumber, qidScans, moiResult ...).' },
    latest: { control: false },
    onChange: { control: false },
    contextIdentity: { control: 'object', description: 'The customer\'s identity drawn on the capture.' },
  },
  args: {
    value: {},
    onChange: fn(),
    latest: { current: {} },
    idType: 'QID',
    verifyThenFetch: false,
    autoDetectIdType: false,
    contextNoDocument: undefined,
    contextHeldTypes: [],
    contextIdentity: undefined,
    scanComplete: false,
    setNotFound: fn(),
    clearReconciliation: fn(),
    demoType: null,
    handleScanAttempt: fn(() => true),
    handleRetakeDone: fn(),
    handleDemoScan: fn(),
    scanBudgetSpent: false,
  },
  render: (args) => <Stateful {...args} />,
} satisfies Meta<typeof IdScannerPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Initiate scan' })).toBeVisible();
  },
};

export const ScanAttempt: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Initiate scan' }));
    await waitFor(() => expect(args.handleScanAttempt).toHaveBeenCalledTimes(1), { timeout: 3000 });
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Retake scan' })).toBeVisible());
  },
};

export const ScanFirstFlowWithDemoDocuments: Story = {
  args: { autoDetectIdType: true },
  parameters: { docs: { description: { story: 'The demo "simulate inserting" links list every document type; they show only while demo content is on.' } } },
};

export const DocumentDetected: Story = {
  args: {
    value: { idNumber: '29850123456', qidScans: { frontScanned: true, backScanned: true, source: 'scan', clear: true } },
    scanComplete: true,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Document detected: Qatar ID')).toBeVisible();
  },
};

export const AttemptsUsedUp: Story = {
  args: { scanBudgetSpent: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Card Could Not Be Read')).toBeVisible();
    await expect(canvas.getByRole('alert')).toHaveTextContent('after the permitted attempts');
  },
};

export const AttemptsUsedUpWithManualEntryNotice: Story = {
  args: { scanBudgetSpent: true, manualEntryNotice: 'Entering the number manually needs Store Manager approval.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent('Store Manager approval');
  },
};

export const CustomerHasNoDocumentOnFile: Story = {
  args: { contextNoDocument: 'Aisha Al Naimi' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('No identity document on file for Aisha Al Naimi');
  },
};

export const CustomerHoldsOtherDocuments: Story = {
  args: { contextNoDocument: 'Aisha Al Naimi', contextHeldTypes: ['Passport'] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('They hold: Passport');
  },
};

export const PassportOnWeb: Story = {
  args: { idType: 'Passport', onVerify: fn() },
  parameters: { docs: { description: { story: 'Passport renders the two flatbed sections; on web the header\'s validate button reads and validates the scanned passport against MOI.' } } },
};
