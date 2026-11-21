import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from 'dxp-ui';
import { ToastContainer } from '../../src/capabilities';
import { notificationActions, type ToastKind, type ToastOptions } from '../../src/stores/notificationSlice';
import { useAction } from '../../src/stores/hooks';
import { connectionLimitReport, ruleConfigV1 } from '../../src/domain/eligibility';
import { connectionLimitToast } from '../../src/capabilities/EligibilityGate/connectionLimitToast';
import { docsParameters } from '../_shared/docs';
import { Row } from '../_shared/layout';

// The Storybook preview already mounts the app's one ToastContainer (the real, protected toast renderer); these stories only dispatch the app's own
// notification actions. The container is the component under test.
const meta = {
  title: 'Feedback & Status/Toast',
  component: ToastContainer,
  parameters: {
    ...docsParameters({
      purpose:
        'The application\'s one toast renderer. It reads the Redux notification queue (`notificationSlice`); a toast is raised by dispatching `notificationActions.pushToast(kind, message, options)`. There is no component prop: everything is state.',
      source: 'src/capabilities/Toasts/Toast.tsx (state: src/stores/notificationSlice.ts)',
      variants: [
        'Kind: success, info, warning, error - the Eligibility gate\'s outcome cards: pass (green tick), advisory (blue "i"), soft stop (amber triangle), hard stop (red cross), each a tinted card with a matching border and a solid icon tile.',
        'Plain toast (message, optional `detail` or `detailLink`) shown below the app header; structured card (`rows`, `brand`, `reference`) on a dark panel at the bottom centre.',
        '`tinted` is a documented option on `ToastOptions` for a success surface.',
      ],
      states: ['Empty (renders nothing)', 'One toast', 'Stacked toasts', 'Auto-dismissed (`autoDismissMs`)', 'Keyed re-push (replaces rather than duplicates)'],
      events: [
        'Dismiss button (aria-label "Dismiss notification") removes that toast.',
        'A pointer press anywhere outside the stack, or Escape, clears every visible toast (history is kept for the bell).',
        '`autoDismissMs` closes a toast by itself; without it the toast stays until dismissed.',
      ],
      usage: ['Dispatch through `useAction(notificationActions.pushToast)`; never build a second toast system.', 'Outside-click dismissal is armed on a deferred tick so the click that raised the toast does not close it.'],
      accessibility: [
        'Error toasts: `role="alert"` with `aria-live="assertive"`. Success, info and warning: `role="status"` with `aria-live="polite"`.',
        'The dismiss control is a button with an accessible name; Escape clears all toasts (keyboard equivalent of an outside click).',
        'Icons are `aria-hidden`; the kind is conveyed by colour, icon and the live-region role.',
      ],
      restrictions: [
        'Because an outside pointer press clears the stack, a second button that raises another toast also dismisses the first (the press lands before the click). Raise a stack from one action.',
      ],
    }),
  },
} satisfies Meta<typeof ToastContainer>;
export default meta;
type Story = StoryObj<typeof meta>;

const MESSAGES: Record<ToastKind, { message: string; detail: string }> = {
  success: { message: 'Order submitted', detail: 'The activation request has been sent.' },
  info: { message: 'Draft saved', detail: 'You can resume it from Draft Orders.' },
  warning: { message: 'Credit limit almost reached', detail: 'Only 5% of the limit remains.' },
  error: { message: 'Could not reach MOI', detail: 'Check the connection and try again.' },
};

function Pusher({ kinds = ['success', 'info', 'warning', 'error'], options }: { kinds?: ToastKind[]; options?: ToastOptions }) {
  const push = useAction(notificationActions.pushToast);
  const clear = useAction(notificationActions.dismissAllToasts);
  // A clean slate for each story (the store is shared by every story in the preview).
  useEffect(() => {
    clear();
  }, [clear]);
  return (
    <Row>
      {kinds.map((k) => (
        <Button key={k} variant="secondary" onClick={() => push(k, MESSAGES[k].message, { detail: MESSAGES[k].detail, ...options })}>
          Show {k} toast
        </Button>
      ))}
    </Row>
  );
}

const body = () => within(document.body);

export const Default: Story = {
  render: () => <Pusher />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Show success toast' }));
    const toast = await body().findByRole('status');
    await expect(toast).toHaveTextContent('Order submitted');
    await expect(toast).toHaveAttribute('aria-live', 'polite');
  },
};

export const Success: Story = {
  render: () => <Pusher kinds={['success']} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Show success toast' }));
    await expect(await body().findByRole('status')).toHaveTextContent('Order submitted');
  },
};

export const Info: Story = {
  render: () => <Pusher kinds={['info']} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Show info toast' }));
    await expect(await body().findByRole('status')).toHaveTextContent('Draft saved');
  },
};

export const Warning: Story = {
  render: () => <Pusher kinds={['warning']} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Show warning toast' }));
    await expect(await body().findByRole('status')).toHaveTextContent('Credit limit almost reached');
  },
};

export const ErrorToast: Story = {
  name: 'Error',
  render: () => <Pusher kinds={['error']} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Show error toast' }));
    const toast = await body().findByRole('alert');
    await expect(toast).toHaveTextContent('Could not reach MOI');
    await expect(toast).toHaveAttribute('aria-live', 'assertive');
  },
};

function StackPusher() {
  const push = useAction(notificationActions.pushToast);
  const clear = useAction(notificationActions.dismissAllToasts);
  useEffect(() => {
    clear();
  }, [clear]);
  return (
    <Button
      onClick={() => {
        (Object.keys(MESSAGES) as ToastKind[]).forEach((k) => push(k, MESSAGES[k].message, { detail: MESSAGES[k].detail }));
      }}
    >
      Show all four kinds
    </Button>
  );
}

export const Stacked: Story = {
  render: () => <StackPusher />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Show all four kinds' }));
    await waitFor(() => expect(body().getAllByRole('status')).toHaveLength(3));
    await expect(body().getAllByRole('alert')).toHaveLength(1);
  },
};

export const ManualDismiss: Story = {
  render: () => <Pusher kinds={['info']} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Show info toast' }));
    await body().findByRole('status');
    await userEvent.click(body().getByRole('button', { name: 'Dismiss notification' }));
    await waitFor(() => expect(body().queryByRole('status')).toBeNull());
  },
};

export const DismissWithEscape: Story = {
  render: () => <StackPusher />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Show all four kinds' }));
    await waitFor(() => expect(body().getAllByRole('status').length).toBeGreaterThan(0));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(body().queryByRole('status')).toBeNull());
    await expect(body().queryByRole('alert')).toBeNull();
  },
};

export const AutoDismiss: Story = {
  render: () => <Pusher kinds={['success']} options={{ autoDismissMs: 1500 }} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Show success toast' }));
    await body().findByRole('status');
    await waitFor(() => expect(body().queryByRole('status')).toBeNull(), { timeout: 4000 });
  },
};

function StructuredPusher() {
  const push = useAction(notificationActions.pushToast);
  const clear = useAction(notificationActions.dismissAllToasts);
  useEffect(() => {
    clear();
  }, [clear]);
  return (
    <Button
      onClick={() =>
        push('success', 'Ticket assigned', {
          reference: 'TT-20418',
          brand: { operator: 'vodafone', segment: 'Consumer', relationship: 'Postpaid' },
          rows: [
            { label: 'Customer', value: 'Sample Customer' },
            { label: 'Mobile number', value: '55001234', sub: '(Postpaid)' },
            { label: 'Ticket', value: 'TT-20418', tone: 'id' },
            { label: 'Status', value: 'Assigned', tone: 'success' },
          ],
        })
      }
    >
      Show structured toast
    </Button>
  );
}

export const Structured: Story = {
  render: () => <StructuredPusher />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Show structured toast' }));
    const toast = await body().findByRole('status');
    await expect(toast).toHaveTextContent('Ticket assigned');
    await expect(toast).toHaveTextContent('TT-20418');
  },
};

function ConnectionLimitPusher() {
  const push = useAction(notificationActions.pushToast);
  const clear = useAction(notificationActions.dismissAllToasts);
  useEffect(() => {
    clear();
  }, [clear]);
  // An expatriate holding 3 Mobile Postpaid, 1 Fixed and 2 Prepaid connections: over the no-approval allowance of 2 Mobile Postpaid.
  const report = connectionLimitReport({ prepaid: 2, postpaid: 3, mobileTotal: 5, fixedFwa: 1 }, 'EXPATRIATE', ruleConfigV1);
  const t = connectionLimitToast(report);
  return <Button onClick={() => push('info', t.message, { rows: t.rows })}>Show connection limit toast</Button>;
}

/** The Contact page's info toast when a customer holds more connections than their limit allows without approval (rules in `src/domain/eligibility/config`). */
export const ConnectionLimitExceeded: Story = {
  render: () => <ConnectionLimitPusher />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Show connection limit toast' }));
    const toast = await body().findByRole('status');
    await expect(toast).toHaveTextContent('Connection Limit Exceeded');
    await expect(toast).toHaveTextContent('Total Connections');
    await expect(toast).toHaveTextContent('approval is required');
  },
};
