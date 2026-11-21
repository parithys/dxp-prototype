// Fixtures and helpers shared by the Application Examples (not a story). Customers, plans, numbers and SIMs are REAL records of public/mock-data, read through
// the app's API layer (services/entityOps); only small plain-data fixtures (a file, a one-pixel signature) are literals.
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { listEntities } from '../../src/services/entityOps';
import { identityFromMoi } from '../../src/capabilities';
import type { GuidedContactValue } from '../../src/capabilities';
import type { EligibilityResult } from '../../src/components/domain/eligibilityTypes';

/** The customers the examples use, by what they demonstrate (all are in public/mock-data/customers.json). */
export const CUSTOMER = {
  /** Clean: QID, Qatari, one postpaid line, no blacklist. */
  clean: 'CUST-1001',
  /** Passport (an exception ID type: Credit Control approval on postpaid). */
  passport: 'CUST-1002',
  /** Blacklisted for collections, owes money: a postpaid soft stop (Prepaid is still offered). */
  collections: 'CUST-1004',
  /** GCC ID (an Emirati): postpaid is not permitted - soft stop. */
  gccId: 'CUST-1005',
  /** Blacklisted for security (Diplomatic ID): hard stop. */
  security: 'CUST-1006',
  /** Qatari QID holding 5 postpaid lines: the line limit routes the order for Credit Control approval. */
  fiveLines: 'CUST-3002',
  /** Qatari QID holding 20 postpaid lines. */
  twentyLines: 'CUST-3082',
  /** Indian QID holding 5 postpaid lines: the expatriate mobile cap blocks a further line. */
  lineCapBlocked: 'CUST-3072',
} as const;

interface CustomerRow {
  customerId: string;
  qid: string;
  idType: string;
  name: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dob: string;
  nationality: string;
  email?: string;
  phone?: string;
  gender?: string;
  preferredLanguage?: string;
  activePostpaidLines?: number;
  activePrepaidLines?: number;
  blacklisted?: boolean;
}
interface DocumentRow {
  customerId: string;
  documentNumber: string;
  documentType?: string;
  expiryDate?: string;
}
interface NasRow {
  documentNumber: string;
  documentType: string;
  expiryDate?: string;
  name: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dob: string;
  nationality: string;
  gender?: string;
  email?: string;
  mobile?: string;
}

/** Loads something once, after the app's mock data is ready (the preview decorator has already booted it). */
export function useLoaded<T>(load: () => Promise<T>, deps: unknown[] = []): T | undefined {
  const [value, setValue] = useState<T | undefined>();
  useEffect(() => {
    let live = true;
    void load().then((v) => live && setValue(v));
    return () => void (live = false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

/** What Customer Verification holds once MOI has validated an EXISTING customer (QID, Passport, GCC ID ...): built from their record and identity document. */
export async function contactOfCustomer(customerId: string): Promise<GuidedContactValue> {
  const [customers, documents] = await Promise.all([listEntities<CustomerRow>('customers'), listEntities<DocumentRow>('identity-documents')]);
  const c = customers.find((x) => x.customerId === customerId);
  if (!c) throw new Error(`${customerId} is not in public/mock-data/customers.json`);
  const doc = documents.find((d) => d.customerId === customerId && d.documentNumber === c.qid) ?? documents.find((d) => d.customerId === customerId);
  const moiResult = {
    name: c.name,
    firstName: c.firstName,
    middleName: c.middleName,
    lastName: c.lastName,
    dob: c.dob,
    nationality: c.nationality,
    email: c.email,
    phone: c.phone,
    gender: c.gender,
    customerId: c.customerId,
    preferredLanguage: c.preferredLanguage,
    emailSource: 'Siebel' as const,
    expiryDate: doc?.expiryDate,
    moiUpdateTime: new Date().toISOString(),
  };
  return {
    idType: c.idType as GuidedContactValue['idType'],
    idNumber: c.qid,
    moiResult,
    mobileNumber: c.phone,
    language: 'English',
    ...identityFromMoi(moiResult),
  };
}

/** What Customer Verification holds for a person only the NAS knows (not a customer yet): their email and mobile come from the NAS and show masked. */
export async function contactOfNasRecord(documentNumber: string): Promise<GuidedContactValue> {
  const nas = (await listEntities<NasRow>('nas-records')).find((r) => r.documentNumber === documentNumber);
  if (!nas) throw new Error(`${documentNumber} is not in public/mock-data/nas-records.json`);
  const moiResult = {
    name: nas.name,
    firstName: nas.firstName,
    middleName: nas.middleName,
    lastName: nas.lastName,
    dob: nas.dob,
    nationality: nas.nationality,
    email: nas.email,
    mobile: nas.mobile,
    gender: nas.gender,
    emailSource: 'NAS' as const,
    isNewCustomer: true,
    expiryDate: nas.expiryDate,
    moiUpdateTime: new Date().toISOString(),
  };
  return { idType: nas.documentType as GuidedContactValue['idType'], idNumber: nas.documentNumber, moiResult, language: 'English', ...identityFromMoi(moiResult) };
}

/** A clean eligibility result for an existing customer, as the Eligibility Gate would hand to Checkout (the shape the Capability Library's Checkout preview uses). */
export const CLEAN_ELIGIBILITY = {
  pass: true,
  hardStop: false,
  softStop: false,
  checks: [],
  blacklisted: false,
  lineCapExceeded: false,
  requiresHrnAdvance: false,
  defaultCreditLimitQar: 1000,
  customerId: CUSTOMER.clean,
  idNumber: '28456701234',
  nationality: 'Qatari',
  segment: 'Consumer',
  isExistingCustomer: true,
} as EligibilityResult;

/** Wraps a scenario in a container of a demo width. */
export function Frame({ width, children }: { width?: number; children: ReactNode }) {
  return <div style={width ? { maxWidth: width } : undefined}>{children}</div>;
}

/** A one-pixel transparent PNG: stands in for a signature a customer drew (the pad itself is exercised in the CAF example's play). */
export const SIGNATURE_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const PNG_BYTES = Uint8Array.from(atob(SIGNATURE_PNG.slice(SIGNATURE_PNG.indexOf(',') + 1)), (c) => c.charCodeAt(0));
/** A small JPG-named file (the upload rules read the name and size). */
export const jpgFile = (name = 'document.jpg') => new File([PNG_BYTES], name, { type: 'image/jpeg' });

/** Puts a file into the visually hidden file input with this accessible name, as choosing it in the file dialog does. */
export async function chooseFile(root: HTMLElement, label: string | RegExp, file: File) {
  const input = within(root).getByLabelText(label) as HTMLInputElement;
  await userEvent.setup({ applyAccept: false }).upload(input, file);
}

/** Chooses an option of the app's searchable Select (a combobox with a listbox), by the field's label. */
export async function chooseOption(root: HTMLElement, field: string | RegExp, option: string | RegExp) {
  const user = userEvent.setup();
  await user.click(within(root).getByRole('combobox', { name: field }));
  await user.click(await within(root).findByRole('option', { name: option }));
}

/** Asserts a button is enabled / disabled. */
export const expectButton = async (root: HTMLElement, name: string | RegExp, enabled: boolean) => {
  const button = await within(root).findByRole('button', { name });
  if (enabled) await expect(button).toBeEnabled();
  else await expect(button).toBeDisabled();
};

/** The slow demo services (MOI, the eligibility service, the desk scanner) answer within this. */
export const SLOW = { timeout: 10000 };

/** The text of the Journey Summary panel(s) (the side panel and the small-screen accordion both carry it), for asserting what the summary lists. */
export const summaryText = (root: HTMLElement): string =>
  [...root.querySelectorAll('aside[aria-label="Summary of completed steps"]')].map((a) => a.textContent ?? '').join(' ');
