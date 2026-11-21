import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppointmentBooking } from '../../src/capabilities';
import { Appointment } from '../../src/capabilities/previewDemos';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Patterns/Appointment Booking',
  component: AppointmentBooking,
  parameters: {
    ...docsParameters({
      purpose: 'Book the installation visit: SLA cluster, the date strip (next working days from the earliest, with each day\'s open slots), the day\'s time slots and technicians free, the customer\'s request for a specific date and time (a later date makes the order future-dated), appointment notes and the documents the technician collects (defaulted from the persona). (Capability registry: "Appointment Booking".)',
      source: 'src/capabilities/AppointmentBooking/AppointmentBooking.tsx (AppointmentBookingStep)',
      states: ['Nothing booked', 'Date chosen, slots loaded', 'Slot chosen', 'Customer-requested later date (future-dated order)', 'Day with no open slots'],
      events: ['`onChange(value)` - the booking (date, slot, technician, notes, documents).'],
      usage: ['Skipped by journeys that activate instantly (`skip`); mounted through `appointmentStep` for installation journeys (Fixed, FWA, fibre).'],
    }),
  },
  argTypes: { value: { control: false }, onChange: { control: false } },
} satisfies Meta<typeof AppointmentBooking>;
export default meta;
type Story = StoryObj<typeof AppointmentBooking>;

/** The app's own Capability Library preview. */
export const Default: Story = { render: () => <Appointment /> };

export const Controlled: Story = {
  render: () => {
    const [v, setV] = useState({});
    return <AppointmentBooking value={v} onChange={setV} />;
  },
};
