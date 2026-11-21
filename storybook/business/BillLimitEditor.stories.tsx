import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { BillLimitEditor } from '../../src/components/domain/BillLimitEditor';
import { docsParameters } from '../_shared/docs';
import { Column, Specimen } from '../_shared/layout';

type EditorProps = Parameters<typeof BillLimitEditor>[0];

/** The editor as the Add-ons step holds it: the limit is the step's value, updated from `onChange`. */
function Demo(props: EditorProps) {
  const [value, setValue] = useState<number | undefined>(props.value);
  return (
    <div style={{ maxWidth: 420 }}>
      <BillLimitEditor
        {...props}
        value={value}
        onChange={(v, pass) => {
          props.onChange(v, pass);
          setValue(v);
        }}
      />
    </div>
  );
}

const meta = {
  title: 'Business Components/Bill Limit Editor',
  component: BillLimitEditor,
  render: (args) => <Demo {...args} />,
  parameters: {
    ...docsParameters({
      purpose: 'Shows a line\'s bill limit with an Edit button that reveals a constrained QAR field. A limit below the product\'s Agent Minimum (QAR 50 Mobile, QAR 75 Mobile Plus - BR-226 / BR-227) is reported through the rule engine (BR-AGENT-MIN-THRESHOLD) as an error under the control and as `pass = false`.',
      source: 'src/components/domain/BillLimitEditor.tsx (rule: src/engines/ruleEngine.ts)',
      variants: ['`product`: Mobile (minimum 50) or Mobile Plus (minimum 75).', '`layout="row"`: a title with the current limit under it and a sentence-case "Edit bill limit" button (the Add-ons step); default is the compact box.', '`bare`: no box around it - it sits directly on the page, e.g. under a separator line.', '`maxLimit`: the credit limit; a bill limit above it cannot be applied (`pass = false`) and the field label states the maximum.'],
      states: ['Viewing (limit and Edit button); Editing (number field + Apply); Validation error (red message under the control); Empty (no `value`: no limit shown).'],
      events: ['`onChange(amount, pass)` on Apply - `pass` is false when the amount is below the Agent Minimum or above `maxLimit`. The caller decides what to do with a failing amount; the editor leaves editing mode either way.'],
      validation: ['The Agent Minimum message ("Entries above the Agent Minimum value (QAR 50) allow the journey to proceed - QAR 10 is below it.") shows once the applied `value` is below the minimum. The minimum and, when given, maximum are named in the field label ("QAR (Agent Min 50, Max 1,000)").'],
      accessibility: ['The field is a labelled number input (spinners hidden). The error is a plain paragraph in the danger colour, not an alert region, so it is not announced when it appears.'],
      restrictions: ['Observed in the source: an amount above `maxLimit` is reported only through `pass = false`; the editor shows no message for it (only the Agent Minimum failure has one). An empty field applies 0.'],
    }),
  },
  argTypes: {
    product: { control: 'select', options: ['Mobile', 'Mobile Plus'], description: 'Decides the Agent Minimum (50 or 75).' },
    value: { control: 'number', description: 'The current bill limit (QAR).' },
    layout: { control: 'select', options: ['default', 'row'], description: 'Compact box or the Add-ons step\'s row.' },
    bare: { control: 'boolean', description: 'No box around it.' },
    maxLimit: { control: 'number', description: 'The credit limit: an upper bound.' },
    onChange: { control: false },
  },
  args: { product: 'Mobile', value: 200, layout: 'default', bare: false, onChange: fn() },
} satisfies Meta<typeof BillLimitEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const RowLayout: Story = { args: { layout: 'row' } };

export const MobilePlus: Story = { args: { product: 'Mobile Plus', value: 300 } };

export const WithCreditLimitMaximum: Story = { args: { maxLimit: 1000 } };

export const Bare: Story = { args: { bare: true } };

export const NoLimitYet: Story = { args: { value: undefined } };

export const BelowAgentMinimum: Story = { args: { value: 30 } };

export const AllLayouts: Story = {
  render: (args) => (
    <Column>
      <Specimen label="Default box">
        <Demo {...args} />
      </Specimen>
      <Specimen label="Row (Add-ons step)">
        <Demo {...args} layout="row" />
      </Specimen>
      <Specimen label="Bare">
        <Demo {...args} bare />
      </Specimen>
    </Column>
  ),
};

export const EditAndApply: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Bill Limit' }));
    const field = canvas.getByLabelText(/QAR \(Agent Min 50\)/);
    await userEvent.clear(field);
    await userEvent.type(field, '300');
    await userEvent.click(canvas.getByRole('button', { name: 'Apply' }));
    await expect(args.onChange).toHaveBeenCalledWith(300, true);
    await expect(canvas.getByText('QAR 300')).toBeInTheDocument();
  },
};

export const ValidationErrorBelowMinimum: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Bill Limit' }));
    const field = canvas.getByLabelText(/QAR \(Agent Min 50\)/);
    await userEvent.clear(field);
    await userEvent.type(field, '10');
    await userEvent.click(canvas.getByRole('button', { name: 'Apply' }));
    await expect(args.onChange).toHaveBeenCalledWith(10, false);
    await expect(await canvas.findByText(/is below it/)).toBeInTheDocument();
  },
};

export const AboveCreditLimitFailsPass: Story = {
  args: { maxLimit: 500 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Bill Limit' }));
    const field = canvas.getByLabelText(/Agent Min 50, Max 500/);
    await userEvent.clear(field);
    await userEvent.type(field, '900');
    await userEvent.click(canvas.getByRole('button', { name: 'Apply' }));
    await expect(args.onChange).toHaveBeenCalledWith(900, false);
  },
};

export const KeyboardEdit: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Edit Bill Limit' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByLabelText(/Agent Min 50/)).toBeInTheDocument();
  },
};
