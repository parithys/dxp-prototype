// Small fixtures shared by the Documents stories: a tiny PNG and files built in memory. Nothing here is a real customer document.
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { forgetDocumentFile, rememberDocumentFile } from '../../src/lib/documentFileStore';

/** A 1 x 1 pixel PNG, as a data URL - the image fixture every story uses. */
export const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
/** A minimal PDF, as a data URL (the browser's viewer opens it). */
export const PDF_DATA_URL = 'data:application/pdf;base64,JVBERi0xLjEKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMjAwIDIwMF0+PmVuZG9iagp0cmFpbGVyPDwvUm9vdCAxIDAgUj4+CiUlRU9G';

const bytesOf = (dataUrl: string) => Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), (c) => c.charCodeAt(0));

/** A small PNG image file. */
export const pngFile = (name = 'front.png') => new File([bytesOf(PNG_DATA_URL)], name, { type: 'image/png' });
/** A small JPG-named file (its content is the PNG fixture; the upload rules read the name and size). */
export const jpgFile = (name = 'scan.jpg') => new File([bytesOf(PNG_DATA_URL)], name, { type: 'image/jpeg' });
/** A small PDF file. */
export const pdfFile = (name = 'letter.pdf') => new File([bytesOf(PDF_DATA_URL)], name, { type: 'application/pdf' });
/** A file of a type the upload rules refuse (only PDF or JPG are accepted). */
export const wrongTypeFile = (name = 'notes.docx') => new File(['not a document the app accepts'], name, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
/** A PDF over the 2 MB limit of the shared upload rules. */
export const oversizeFile = (name = 'big-scan.pdf') => new File([new Uint8Array(2 * 1024 * 1024 + 1)], name, { type: 'application/pdf' });

/** A user-event that does NOT filter files by the input's `accept`, so a wrong type reaches the component and its own refusal message shows. */
export const uploader = () => userEvent.setup({ applyAccept: false });

/** Puts a file into the (visually hidden) file input of the element, as choosing it in the file dialog does. */
export async function chooseFile(root: HTMLElement, file: File, label?: string | RegExp) {
  const input = (label ? within(root).getByLabelText(label) : root.querySelector('input[type="file"]')) as HTMLInputElement | null;
  if (!input) throw new Error('No file input found');
  await uploader().upload(input, file);
}

/** Chooses an option of the app's searchable Select (a combobox with a listbox), by the field's label. */
export async function chooseOption(root: HTMLElement, field: string | RegExp, option: string) {
  const user = userEvent.setup();
  await user.click(within(root).getByRole('combobox', { name: field }));
  await user.click(await within(root).findByRole('option', { name: option }));
}

/** Waits until an alert with the text is on screen. */
export async function expectAlert(root: HTMLElement, text: string | RegExp) {
  await waitFor(() => expect(within(root).getByRole('alert')).toHaveTextContent(text));
}

/** Seeds the in-memory file store (src/lib/documentFileStore.ts) so an uploaded document can be opened; returns a cleanup. */
export function seedStoredFile(id: string, dataUrl: string, mime: string): () => void {
  rememberDocumentFile(id, dataUrl, mime);
  return () => forgetDocumentFile(id);
}

/** Draws a short stroke on the signature canvas inside the element, with real pointer events. */
export async function drawSignature(root: HTMLElement) {
  const pad = root.querySelector('canvas') as HTMLCanvasElement | null;
  if (!pad) throw new Error('No signature canvas found');
  await userEvent.pointer([
    { keys: '[MouseLeft>]', target: pad, coords: { clientX: 40, clientY: 40 } },
    { target: pad, coords: { clientX: 120, clientY: 90 } },
    { target: pad, coords: { clientX: 200, clientY: 50 } },
    { keys: '[/MouseLeft]', target: pad },
  ]);
}
