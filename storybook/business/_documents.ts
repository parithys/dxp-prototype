// Shared play helper for the stories of dialogs that take a supporting document (Additional Discount, Exception Request): the document control is
// device-dependent (Web scans, Tablet uploads - see DocumentCaptureActions), so one helper attaches a document whichever the toolbar's Device is.
import { expect, screen, waitFor, within } from 'storybook/test';
import { chooseFile, pdfFile } from '../documents/fixtures';

/** Attaches a document inside the open dialog: Initiate Scan on Web, a chosen PDF on Tablet. Resolves once the file name is listed. */
export async function attachDocument(dialog: HTMLElement, userClick: (el: HTMLElement) => Promise<void>) {
  const scan = within(dialog).queryByRole('button', { name: 'Initiate Scan' });
  if (scan) {
    await userClick(scan);
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Remove' })).toBeVisible(), { timeout: 4000 });
  } else {
    await chooseFile(dialog, pdfFile('court-order.pdf'), /Choose the/);
    await waitFor(() => expect(within(dialog).getByText(/court-order\.pdf/)).toBeVisible());
  }
}

/** The one open dialog (modals render in a portal outside the story canvas). */
export const openDialog = () => screen.findByRole('dialog');
