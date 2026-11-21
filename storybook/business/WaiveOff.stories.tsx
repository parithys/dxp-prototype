import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';
import { WaiveOff } from '../../src/capabilities/NumberSelection/WaiveOff';
import type { AdditionalDocument } from '../../src/capabilities';
import { docsParameters } from '../_shared/docs';
import { attachDocument } from './_documents';

type WaiveOffProps = Parameters<typeof WaiveOff>[0];

/** The button as Number Selection holds it: the discount lives in the journey, here in local state. */
function Demo(props: WaiveOffProps) {
  const [waiver, setWaiver] = useState(props.waiver);
  const [document, setDocument] = useState<AdditionalDocument | undefined>(props.document);
  return (
    <WaiveOff
      {...props}
      waiver={waiver}
      onChange={(w) => {
        setWaiver(w);
        props.onChange(w);
      }}
      document={document}
      onDocumentChange={props.onDocumentChange ? (d) => {
        setDocument(d);
        props.onDocumentChange?.(d);
      } : undefined}
    />
  );
}

const meta = {
  title: 'Business Components/Waive Off',
  component: WaiveOff,
  render: (args) => <Demo {...args} />,
  parameters: {
    ...docsParameters({
      purpose: 'The "Additional Discount" action beside Continue on Number Selection. The agent enters a FIXED AMOUNT in QAR (never a percentage) to waive off a Star number\'s upfront charge; the amount is kept on the journey and read by Checkout, Payment and the order.',
      source: 'src/capabilities/NumberSelection/WaiveOff.tsx',
      variants: [
        'Without `onDocumentChange`: amount only ("Orders with additional discounts require approval.").',
        'With `onDocumentChange` (and optionally `documentRequirement`): the dialog also asks for a Supporting Document, attached under the configured requirement.',
        'Button label: "Additional Discount", or "Additional Discount: QAR n" once a waiver is set.',
      ],
      states: [
        'No charge and no number chosen: renders nothing.',
        'No charge but a number chosen (`numberChosen`): a disabled button with the reason as its title.',
        'Dialog open: empty, valid amount, invalid amount (error under the field), zero (removes the discount, no document needed).',
        'Apply Discount disabled while the amount is invalid, or - when the upload is offered - a non-zero amount has no document.',
      ],
      events: ['`onChange(waiver)` with the amount waived (undefined when set to 0).', '`onDocumentChange(document)` with the attached document on Apply (undefined when the discount is removed). Cancel leaves what was attached as it was.'],
      validation: ['Zero or more, not above the amount to pay: "Enter an amount of zero or more..." / "The waiver cannot be more than the amount to pay of QAR n." (shown once something is typed). Only digits, "." and "," are accepted.', 'The summary shows Amount to Pay, Additional Discount and Payable; an invalid amount discounts nothing.'],
      accessibility: ['The dialog is the app\'s Modal (focus trapped, Escape closes, focus returns to the button). The amount field is labelled "Discount Amount" and marked required; its error is tied to the field. A file error is a `role="alert"`.'],
      devices: ['The document control follows the device: Web offers Initiate Scan (the demo desk scanner), Tablet offers Upload Document. The toolbar\'s Device switch selects the experience.'],
    }),
  },
  argTypes: {
    chargeQar: { control: 'number', description: 'The Star number\'s upfront charge (amount to pay), in QAR. 0 or less: nothing to discount.' },
    numberChosen: { control: 'boolean', description: 'A number is chosen: the button shows (disabled) even when there is no charge.' },
    waiver: { control: 'number', description: 'The amount already waived, in QAR (undefined: none).' },
    documentRequirement: { control: 'object', description: 'The configured document this discount requires: { id, label }.' },
    document: { control: 'object', description: 'The supporting document already attached.' },
    onChange: { control: false },
    onDocumentChange: { control: false },
  },
  args: { chargeQar: 1500, numberChosen: true, waiver: undefined, onChange: fn() },
} satisfies Meta<typeof WaiveOff>;
export default meta;
type Story = StoryObj<typeof meta>;

const open = async (canvasElement: HTMLElement) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: /^Additional Discount/ }));
  return screen.findByRole('dialog');
};

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await open(canvasElement);
    await expect(dialog).toHaveAccessibleName('Additional Discount');
    await expect(within(dialog).getByRole('button', { name: 'Apply Discount' })).toBeDisabled();
  },
};

export const WithSupportingDocument: Story = {
  args: { documentRequirement: { id: 'DOC-DISCOUNT', label: 'Supporting Document' }, onDocumentChange: fn() },
  play: async ({ canvasElement, args }) => {
    const dialog = await open(canvasElement);
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Discount Amount/ }), '500');
    await expect(within(dialog).getByRole('button', { name: 'Apply Discount' })).toBeDisabled();
    await attachDocument(dialog, (el) => userEvent.click(el));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply Discount' }));
    await expect(args.onChange).toHaveBeenCalledWith(500);
    await expect(args.onDocumentChange).toHaveBeenCalled();
    await waitFor(() => expect(within(canvasElement).getByRole('button', { name: /Additional Discount: / })).toBeVisible());
  },
};

export const AmountOnly: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = await open(canvasElement);
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Discount Amount/ }), '250');
    await expect(within(dialog).getByText('Payable').nextElementSibling).toHaveTextContent('1,250');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply Discount' }));
    await expect(args.onChange).toHaveBeenCalledWith(250);
  },
};

export const AmountAboveTheCharge: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await open(canvasElement);
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Discount Amount/ }), '2000');
    await expect(within(dialog).getByText(/cannot be more than the amount to pay/)).toBeVisible();
    await expect(within(dialog).getByRole('button', { name: 'Apply Discount' })).toBeDisabled();
  },
};

export const AlreadyApplied: Story = {
  args: { waiver: 300 },
  play: async ({ canvasElement }) => {
    const dialog = await open(canvasElement);
    await expect(within(dialog).getByRole('textbox', { name: /Discount Amount/ })).toHaveValue('300');
  },
};

export const ZeroRemovesTheDiscount: Story = {
  args: { waiver: 300, onDocumentChange: fn() },
  play: async ({ canvasElement, args }) => {
    const dialog = await open(canvasElement);
    const field = within(dialog).getByRole('textbox', { name: /Discount Amount/ });
    await userEvent.clear(field);
    await userEvent.type(field, '0');
    await expect(within(dialog).queryByText('Supporting Document')).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply Discount' }));
    await expect(args.onChange).toHaveBeenCalledWith(undefined);
  },
};

export const NoChargeNumberChosen: Story = {
  args: { chargeQar: 0 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Additional Discount' })).toBeDisabled();
  },
};

export const NoChargeNoNumber: Story = {
  args: { chargeQar: 0, numberChosen: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).toBeNull();
  },
};

export const EscapeCancels: Story = {
  play: async ({ canvasElement, args }) => {
    await open(canvasElement);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};
