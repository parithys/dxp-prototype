import { uploadRules, type UploadRules } from 'dxp-ui';

// The app's upload rules, defined once (the helpers and the type are the library's): every upload (the identity document, the signed CAF, Additional Documents) reads them from here, so a limit is changed once.
// Part of the Document Upload capability (capabilities/DocumentUpload).
export const UPLOAD_RULES = {
  /** An identity document (scan alternative): PDF or JPG, 2 MB. */
  identity: uploadRules(['pdf', 'jpg', 'jpeg'], 2, 'PDF or JPG'),
  /** Supporting paperwork (signed CAF, additional documents): PDF or JPG, 2 MB. */
  supporting: uploadRules(['pdf', 'jpg', 'jpeg'], 2, 'PDF or JPG'),
} as const satisfies Record<string, UploadRules>;
