'use client';
// A development-only page for checking the themed shadcn/ui components (src/components/ui) against the app's own (src/components/primitives): each
// pair renders the same thing, existing on the left and shadcn/ui on the right, so a difference is visible at a glance. The tablet block is the
// same components inside data-device="tablet" (the app's touch scale); use the header's theme toggle for dark. Isolated: delete this folder,
// app/dev/ and the UiShowcaseRoute line in src/next/routes.tsx to remove it. In no navigation; "not found" outside a development build.
import { useEffect, useState } from 'react';
import { ArrowRightIcon, PlusIcon, SearchIcon } from 'lucide-react';
import { SEARCH_ICON, IconButton, Input as AppInput, Modal, Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, BaseInput as Input, Label, BaseTabs as Tabs, TabsContent, TabsList, TabsTrigger } from 'dxp-ui';

// The app's variant name -> the shadcn/ui variant that renders the same look.
// The retired primitives/Button rendered exactly this markup; kept here, raw, as the "existing" reference the themed Button is compared with.
function AppButton({ variant = 'primary', size = 'md', children, ...rest }: { variant?: 'primary' | 'secondary' | 'tertiary' | 'destructive'; size?: 'sm' | 'md' | 'lg' } & Omit<React.ComponentProps<'button'>, 'type'>) {
  return (
    <button type="button" className={`btn btn-${variant} ${variant === 'tertiary' ? '' : `btn-${size}`}`} {...rest}>{children}</button>
  );
}

const BUTTONS = [
  { app: 'primary', themed: 'default', label: 'Primary' },
  { app: 'secondary', themed: 'secondary', label: 'Secondary' },
  { app: 'tertiary', themed: 'tertiary', label: 'Tertiary' },
  { app: 'destructive', themed: 'destructive', label: 'Destructive' },
] as const;
const SIZES = ['sm', 'md', 'lg'] as const;

// A label column, then the app's component, then the themed one.
const PAIR_COLUMNS = { gridTemplateColumns: '8rem 1fr 1fr' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="stack">
      <h2 className="title title-md">{title}</h2>
      {children}
    </section>
  );
}

/** One row: the app's component on the left, the themed shadcn/ui one on the right. */
function Pair({ label, existing, themed }: { label: string; existing: React.ReactNode; themed: React.ReactNode }) {
  return (
    <div className="grid items-center gap-4" style={PAIR_COLUMNS}>
      <span className="caption-muted">{label}</span>
      <div className="cluster">{existing}</div>
      <div className="cluster">{themed}</div>
    </div>
  );
}

function Parity() {
  const [checked, setChecked] = useState(true);
  return (
    <div className="stack">
      <div className="grid gap-4" style={PAIR_COLUMNS}>
        <span />
        <span className="eyebrow">Existing</span>
        <span className="eyebrow">shadcn/ui, themed</span>
      </div>

      {BUTTONS.map((b) => (
        <Pair
          key={b.app}
          label={b.label}
          existing={SIZES.map((size) => (
            <AppButton key={size} variant={b.app} size={size}>{b.label}</AppButton>
          ))}
          themed={SIZES.map((size) => (
            <Button key={size} variant={b.themed} size={size}>{b.label}</Button>
          ))}
        />
      ))}
      <Pair label="Disabled" existing={<><AppButton disabled>Primary</AppButton><AppButton variant="secondary" disabled>Secondary</AppButton><AppButton variant="destructive" disabled>Destructive</AppButton></>} themed={<><Button disabled>Primary</Button><Button variant="secondary" disabled>Secondary</Button><Button variant="destructive" disabled>Destructive</Button></>} />
      <Pair label="Leading Icon" existing={<AppButton>Add Line</AppButton>} themed={<Button><PlusIcon className="size-4 shrink-0" />Add Line</Button>} />
      <Pair label="Trailing Icon" existing={<AppButton>Continue</AppButton>} themed={<Button>Continue<ArrowRightIcon className="size-4 shrink-0" /></Button>} />
      <Pair label="Icon Only" existing={<IconButton icon={SEARCH_ICON} label="Search" />} themed={<Button size="icon" aria-label="Search"><SearchIcon className="size-4 shrink-0" /></Button>} />

      <Pair label="Input" existing={<div className="w-full"><AppInput label="Full Name" value="" onChange={() => {}} /></div>} themed={<div className="stack w-full"><Label htmlFor="parity-name" className="field-label">Full Name</Label><Input id="parity-name" className="w-full" /></div>} />
      <Pair label="Input Filled" existing={<div className="w-full"><AppInput label="Full Name" value="Fatima Al-Kuwari" onChange={() => {}} /></div>} themed={<div className="stack w-full"><Label htmlFor="parity-filled" className="field-label">Full Name</Label><Input id="parity-filled" className="w-full" value="Fatima Al-Kuwari" onChange={() => {}} /></div>} />
      <Pair label="Input Error" existing={<div className="w-full"><AppInput label="Full Name" value="" error="Enter the full name" onChange={() => {}} /></div>} themed={<div className="stack w-full"><Label htmlFor="parity-error" className="field-label">Full Name</Label><Input id="parity-error" className="w-full" aria-invalid="true" /></div>} />
      <Pair label="Input Disabled" existing={<div className="w-full"><AppInput label="Full Name" value="Fatima Al-Kuwari" disabled onChange={() => {}} /></div>} themed={<div className="stack w-full"><Label htmlFor="parity-disabled" className="field-label">Full Name</Label><Input id="parity-disabled" className="w-full" value="Fatima Al-Kuwari" disabled onChange={() => {}} /></div>} />
      <Pair label="Checkbox" existing={<span className="caption-muted">The app checkbox is now this one</span>} themed={<><Checkbox aria-label="Unchecked" /><Checkbox aria-label="Checked" checked={checked} onCheckedChange={(v) => setChecked(v === true)} /><Checkbox aria-label="Disabled" disabled /></>} />
    </div>
  );
}

/** Emulates a touch device the way the app does: data-device="tablet" on <html>. Put back when the page closes. */
function TabletToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (on) document.documentElement.dataset.device = 'tablet';
    return () => {
      delete document.documentElement.dataset.device;
    };
  }, [on]);
  return (
    <div className="cluster">
      <Button variant="secondary" onClick={() => setOn((v) => !v)}>{on ? 'Switch To Pointer Scale' : 'Switch To Tablet Scale'}</Button>
    </div>
  );
}

function CardSample() {
  return (
    <Card className="stack max-w-sm py-4">
      <CardHeader>
        <CardTitle>Customer Summary</CardTitle>
        <CardDescription>A card with a header, content and footer.</CardDescription>
      </CardHeader>
      <CardContent>Content sits here.</CardContent>
      <CardFooter>
        <Button size="sm">Open</Button>
      </CardFooter>
    </Card>
  );
}

// Nested overlays (docs/migration/phase6-overlays-select.md): a Dialog holding a button that opens the app's Modal above it, the way an offer drawer opens over a
// journey step. Exercised by e2e/overlays.spec.ts.
function MixedOverlays() {
  const [inner, setInner] = useState(false);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">Open Radix Dialog Over Legacy Modal</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Radix Outer</DialogTitle>
          <DialogDescription>Opens the app's Modal above it.</DialogDescription>
        </DialogHeader>
        <Button onClick={() => setInner(true)}>Open Legacy Modal</Button>
        <Modal open={inner} onClose={() => setInner(false)} title="Legacy Inner" footer={<Button onClick={() => setInner(false)}>Done</Button>}>
          <p className="text-secondary">The app&apos;s Modal, portalled to the body outside the Radix content.</p>
        </Modal>
      </DialogContent>
    </Dialog>
  );
}

export function UiShowcase() {
  return (
    <>
      <div className="stack mx-auto max-w-5xl p-8" data-testid="ui-showcase">
        <header>
          <h1 className="title title-xl">Component Showcase</h1>
          <p className="text-muted-foreground">Development only. Compare the themed shadcn/ui components with the app's own; use the header's theme toggle for dark.</p>
        </header>

        <Section title="Existing Versus Themed">
          <Parity />
        </Section>

        <Section title="Card">
          <div className="grid grid-cols-2 gap-4">
            <div className="card stack p-4">
              <h3 className="title title-md">Customer Summary</h3>
              <p className="caption-muted">A card with a header, content and footer.</p>
              <span>Content sits here.</span>
              <AppButton size="sm">Open</AppButton>
            </div>
            <CardSample />
          </div>
        </Section>

        <Section title="Tablet Scale">
          <p className="caption-muted">The app sets data-device="tablet" on the page root for touch devices; this switches it on, so every control above takes the touch sizes (the control-height tokens, the touch targets).</p>
          <TabletToggle />
        </Section>

        <Section title="Narrow Width">
          <div className="card stack p-4 max-w-[var(--size-device-preview-w)]">
            <Label htmlFor="narrow" className="field-label">Mobile Number</Label>
            <Input id="narrow" />
            <Button className="w-full">Continue</Button>
          </div>
        </Section>

        <Section title="Nested Overlays">
          <MixedOverlays />
        </Section>

        <Section title="Other Components">
          <div className="cluster">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">Open Dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm</DialogTitle>
                  <DialogDescription>A dialog with a title, a description and a footer.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button>Continue</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">Menu</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>View</DropdownMenuItem>
                <DropdownMenuItem>Edit</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Tabs defaultValue="one" className="max-w-sm">
            <TabsList>
              <TabsTrigger value="one">One</TabsTrigger>
              <TabsTrigger value="two">Two</TabsTrigger>
            </TabsList>
            <TabsContent value="one">First panel</TabsContent>
            <TabsContent value="two">Second panel</TabsContent>
          </Tabs>
        </Section>
      </div>
    </>
  );
}
