import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { PassportScanSections } from '../../src/components/domain/PassportScanSections';
import type { QidImageUploadValue } from '../../src/components/domain/qidImageUploadModel';
import { docsParameters } from '../_shared/docs';

type Props = Parameters<typeof PassportScanSections>[0];

function Stateful(props: Props) {
  const [value, setValue] = useState<QidImageUploadValue>(props.value);
  return (
    <PassportScanSections
      {...props}
      value={value}
      onChange={(v) => {
        setValue(v);
        props.onChange(v);
      }}
    />
  );
}

const meta = {
  title: 'Documents/Passport Scan Sections',
  component: PassportScanSections,
  parameters: {
    ...docsParameters({
      purpose: 'Passport capture: two separate scanning sections, one per side, each read on the flatbed scanner. The front (the data page) is what is validated; the back is optional. The attempt budget is charged once per document pass, not once per side.',
      source: 'src/components/domain/PassportScanSections.tsx (rendered by QidImageUpload when `documentType` is "Passport")',
      variants: ['Front and back sections, each with its own `Scan front side` / `Scan back side` button and, once captured, `Retake scan`.', 'With `onVerify`: a `Validate with MOI` button in the header (enabled once the front is scanned).'],
      states: ['Empty sections (scan frame and prompt; the back says it is optional).', 'Scanning one side (spinner).', 'Captured (clear or blurred: `blurFirstScan` makes each side\'s first pass unclear).', 'Validating (`verifying`), Validated (`verified`), `verifyDisabled`.', 'Reader out of attempts (`canScan` false) with a failure notice.'],
      events: ['`onChange`, `onScan`, `onRetakeDone` as for the QID card; `onVerify()` - validate the passport against MOI.'],
      devices: ['Same on Web and Tablet: only the reader is offered (`idCaptureOptions`).'],
    }),
  },
  argTypes: {
    canScan: { control: 'boolean', description: 'False once the attempt budget is spent.' },
    blurFirstScan: { control: 'boolean', description: 'Demo: the first pass over each side is unclear.' },
    hideUnclearNotice: { control: 'boolean', description: 'Hides the "Image unclear" alert.' },
    verifying: { control: 'boolean', description: 'The MOI validation is running.' },
    verifyDisabled: { control: 'boolean', description: 'Disables the Validate button.' },
    verified: { control: 'boolean', description: 'Validated: the button stays disabled.' },
    error: { control: 'object', description: 'Failure text or lines.' },
    value: { control: 'object', description: 'The capture (frontScanned, backScanned, ...).' },
    onChange: { control: false },
    onScan: { control: false },
    onRetakeDone: { control: false },
    onVerify: { control: false },
    onDemoScan: { control: false },
  },
  args: { value: {}, onChange: fn(), onScan: fn(() => true), onVerify: fn() },
  render: (args) => <Stateful {...args} />,
} satisfies Meta<typeof PassportScanSections>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Scan front side' })).toBeVisible();
    await expect(canvas.getByText('Scanning the back side of the passport is optional.')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Validate with MOI' })).toBeDisabled();
  },
};

export const ScanFrontThenValidate: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Scan front side' }));
    await expect(await canvas.findByText('Scanning Passport front side')).toBeVisible();
    await waitFor(() => expect(canvas.getByText('Passport front')).toBeVisible(), { timeout: 3000 });
    await expect(canvas.getByRole('button', { name: 'Validate with MOI' })).toBeEnabled();
    await userEvent.click(canvas.getByRole('button', { name: 'Validate with MOI' }));
    await expect(args.onVerify).toHaveBeenCalledTimes(1);
  },
};

export const FrontScanned: Story = { args: { value: { frontScanned: true, clear: true } } };
export const BothSidesScanned: Story = { args: { value: { frontScanned: true, backScanned: true, clear: true } } };
export const UnclearFirstScan: Story = {
  args: { blurFirstScan: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Scan front side' }));
    await waitFor(() => expect(canvas.getByRole('alert')).toHaveTextContent('Image unclear'), { timeout: 3000 });
    await userEvent.click(canvas.getByRole('button', { name: 'Retake scan' }));
    await waitFor(() => expect(canvas.queryByRole('alert')).toBeNull(), { timeout: 3000 });
  },
};
export const Validating: Story = { args: { value: { frontScanned: true, clear: true }, verifying: true } };
export const Validated: Story = { args: { value: { frontScanned: true, clear: true }, verified: true } };
export const AttemptsUsedUp: Story = {
  args: {
    canScan: false,
    error: ['We could not read the document after the permitted attempts.', 'Select the ID type and enter the number manually to continue.'],
  },
};
