/**
 * The emails GoMingle sends. Each entry is the default wording an admin can
 * change under Configure → Email Templates, plus the placeholders that email
 * supports and the sample values its preview and test send use.
 */

export type Audience = 'partner' | 'admin' | 'mingler'

export interface Placeholder {
  name: string
  description: string
  sample: string
}

export interface TemplateDefault {
  key: string
  audience: Audience
  name: string
  description: string
  /** Account emails people need to get in; they can't be switched off. */
  required: boolean
  placeholders: Placeholder[]
  subject: string
  heading: string
  body: string
  buttonLabel: string
  /** Which placeholder holds the button's link. */
  buttonUrl: string | null
}

const P = {
  name: { name: 'name', description: "Recipient's name", sample: 'Raees Khan' },
  code: { name: 'code', description: 'The 6-digit code', sample: '482915' },
  minutes: { name: 'minutes', description: 'How long the code works, in minutes', sample: '10' },
  restaurantName: { name: 'restaurantName', description: 'Restaurant name', sample: 'Kolachi' },
  city: { name: 'city', description: 'Restaurant city', sample: 'Karachi' },
  category: { name: 'category', description: 'Restaurant category', sample: 'Fine Dining' },
  reason: { name: 'reason', description: 'Reason given by GoMingle', sample: 'Please upload a clearer menu photo.' },
  amount: { name: 'amount', description: 'Payout amount', sample: 'PKR 2,640' },
  fee: { name: 'fee', description: 'GoMingle fee taken from the payout', sample: 'PKR 360' },
  bookingRef: { name: 'bookingRef', description: 'Booking reference', sample: 'GM-191480' },
  bank: { name: 'bank', description: 'Bank the payout went to', sample: 'Meezan Bank' },
  account: { name: 'account', description: 'Masked account number', sample: 'PK36 •••• 6702' },
  email: { name: 'email', description: "Recipient's sign-in email", sample: 'sara@kolachi.pk' },
  addedBy: { name: 'addedBy', description: 'Who added the person', sample: 'Raees Khan' },
  roleName: { name: 'roleName', description: 'Admin role', sample: 'Operations' },
  partnerPortalUrl: { name: 'partnerPortalUrl', description: 'Partner Portal link', sample: 'https://gomingle-partner.vercel.app' },
  adminPortalUrl: { name: 'adminPortalUrl', description: 'Admin Panel link', sample: 'https://gomingle-admin.vercel.app' },
  eventName: { name: 'eventName', description: 'Interest table name', sample: 'Startup Mixer' },
  eventDate: { name: 'eventDate', description: 'Date and time of the dinner (Pakistan time)', sample: 'Fri 20 Nov 2026, 7:30 pm' },
  emptySeats: { name: 'emptySeats', description: 'Seats that stayed empty', sample: '2' },
  seats: { name: 'seats', description: 'Seats booked', sample: '4' },
  penaltyPerSeat: { name: 'penaltyPerSeat', description: 'Penalty for one empty seat', sample: 'PKR 1,500' },
  penaltyTotal: { name: 'penaltyTotal', description: 'Total penalty charged to the card', sample: 'PKR 3,000' },
  approvalUrl: { name: 'approvalUrl', description: 'Link to the application', sample: 'https://gomingle-admin.vercel.app/approval-queue' },
} satisfies Record<string, Placeholder>

export const TEMPLATE_DEFAULTS: TemplateDefault[] = [
  // ── Partners ──────────────────────────────────────────────────────────────
  {
    key: 'partner_signup_code',
    audience: 'partner',
    name: 'Sign-up code',
    description: 'Sent when someone starts a Partner Portal sign-up.',
    required: true,
    placeholders: [P.code, P.minutes],
    subject: 'Your GoMingle sign-up code: {{code}}',
    heading: 'Confirm your email',
    body: 'Use this code to finish creating your GoMingle partner account:\n\n{{code}}\n\nIt works for {{minutes}} minutes. If you did not start a sign-up, you can ignore this email.',
    buttonLabel: '',
    buttonUrl: null,
  },
  {
    key: 'partner_password_reset',
    audience: 'partner',
    name: 'Password reset code',
    description: 'Sent when a partner uses Forgot password.',
    required: true,
    placeholders: [P.name, P.code, P.minutes],
    subject: 'Your GoMingle password reset code: {{code}}',
    heading: 'Reset your password',
    body: 'Hi {{name}},\n\nUse this code to set a new password for the Partner Portal:\n\n{{code}}\n\nIt works for {{minutes}} minutes. If you did not ask for this, you can ignore this email; your password stays the same.',
    buttonLabel: '',
    buttonUrl: null,
  },
  {
    key: 'partner_team_welcome',
    audience: 'partner',
    name: 'Team member added',
    description: 'Sent to a person a restaurant owner adds on the Team screen.',
    required: false,
    placeholders: [P.name, P.restaurantName, P.addedBy, P.email, P.partnerPortalUrl],
    subject: "You've been added to {{restaurantName}} on GoMingle",
    heading: 'Welcome to the team',
    body: 'Hi {{name}},\n\n{{addedBy}} added you to {{restaurantName}} on the GoMingle Partner Portal.\n\nSign in with {{email}} and the password {{addedBy}} shared with you. You can change it any time under My Account.',
    buttonLabel: 'Open the Partner Portal',
    buttonUrl: 'partnerPortalUrl',
  },
  {
    key: 'restaurant_approved',
    audience: 'partner',
    name: 'Restaurant approved',
    description: 'Sent to the owner when GoMingle approves the application.',
    required: false,
    placeholders: [P.name, P.restaurantName, P.category, P.partnerPortalUrl],
    subject: '{{restaurantName}} is live on GoMingle',
    heading: 'Your restaurant is live',
    body: 'Hi {{name}},\n\nGood news: {{restaurantName}} was approved in the {{category}} category and is now visible to Minglers on GoMingle.\n\nKeep your tables, menu and availability up to date so Minglers can book.',
    buttonLabel: 'Go to your dashboard',
    buttonUrl: 'partnerPortalUrl',
  },
  {
    key: 'restaurant_declined',
    audience: 'partner',
    name: 'Application needs changes',
    description: 'Sent to the owner when GoMingle declines the application.',
    required: false,
    placeholders: [P.name, P.restaurantName, P.reason, P.partnerPortalUrl],
    subject: '{{restaurantName}}: your application needs changes',
    heading: 'Your application needs changes',
    body: 'Hi {{name}},\n\nWe reviewed the application for {{restaurantName}} and need a few changes before it can go live:\n\n{{reason}}\n\nUpdate your profile and submit it again; we will review it as soon as it comes in.',
    buttonLabel: 'Update your profile',
    buttonUrl: 'partnerPortalUrl',
  },
  {
    key: 'restaurant_suspended',
    audience: 'partner',
    name: 'Restaurant suspended',
    description: 'Sent to the owner when GoMingle suspends the restaurant.',
    required: false,
    placeholders: [P.name, P.restaurantName, P.reason, P.partnerPortalUrl],
    subject: '{{restaurantName}} is suspended on GoMingle',
    heading: 'Your restaurant is suspended',
    body: 'Hi {{name}},\n\n{{restaurantName}} is hidden from the Mingler app and new bookings are paused.\n\nReason: {{reason}}\n\nReply to this email or contact GoMingle support to resolve it.',
    buttonLabel: '',
    buttonUrl: 'partnerPortalUrl',
  },
  {
    key: 'restaurant_reactivated',
    audience: 'partner',
    name: 'Restaurant reactivated',
    description: 'Sent to the owner when GoMingle lifts a suspension.',
    required: false,
    placeholders: [P.name, P.restaurantName, P.partnerPortalUrl],
    subject: '{{restaurantName}} is live on GoMingle again',
    heading: 'Welcome back',
    body: 'Hi {{name}},\n\n{{restaurantName}} is visible to Minglers again and can take new bookings.',
    buttonLabel: 'Go to your dashboard',
    buttonUrl: 'partnerPortalUrl',
  },
  {
    key: 'payout_released',
    audience: 'partner',
    name: 'Payout released',
    description: 'Sent to the owner when GoMingle releases a payout from escrow.',
    required: false,
    placeholders: [P.name, P.restaurantName, P.amount, P.fee, P.bookingRef, P.bank, P.account, P.partnerPortalUrl],
    subject: 'Payout of {{amount}} released for {{bookingRef}}',
    heading: 'Payout released',
    body: 'Hi {{name}},\n\n{{amount}} for booking {{bookingRef}} at {{restaurantName}} was released to {{bank}} {{account}}.\n\nThe GoMingle fee of {{fee}} was taken before payout. You can see every payout under Finances.',
    buttonLabel: 'View finances',
    buttonUrl: 'partnerPortalUrl',
  },

  // ── Admins ────────────────────────────────────────────────────────────────
  {
    key: 'admin_password_reset',
    audience: 'admin',
    name: 'Password reset code',
    description: 'Sent when an admin uses Forgot password.',
    required: true,
    placeholders: [P.name, P.code, P.minutes],
    subject: 'Your GoMingle Admin password reset code: {{code}}',
    heading: 'Reset your password',
    body: 'Hi {{name}},\n\nUse this code to set a new password for the GoMingle Admin Panel:\n\n{{code}}\n\nIt works for {{minutes}} minutes. If you did not ask for this, tell your GoMingle administrator.',
    buttonLabel: '',
    buttonUrl: null,
  },
  {
    key: 'admin_user_welcome',
    audience: 'admin',
    name: 'Admin user added',
    description: 'Sent to a person added on the Users screen.',
    required: false,
    placeholders: [P.name, P.roleName, P.addedBy, P.email, P.adminPortalUrl],
    subject: "You've been added to the GoMingle Admin Panel",
    heading: 'Welcome to GoMingle',
    body: 'Hi {{name}},\n\n{{addedBy}} added you to the GoMingle Admin Panel as {{roleName}}.\n\nSign in with {{email}} and the password {{addedBy}} shared with you, then change it under your profile.',
    buttonLabel: 'Open the Admin Panel',
    buttonUrl: 'adminPortalUrl',
  },
  {
    key: 'admin_new_application',
    audience: 'admin',
    name: 'New restaurant application',
    description: 'Sent to admins who review applications when a restaurant submits or resubmits.',
    required: false,
    placeholders: [P.restaurantName, P.city, P.approvalUrl],
    subject: 'New application: {{restaurantName}} ({{city}})',
    heading: 'A restaurant is waiting for review',
    body: '{{restaurantName}} in {{city}} submitted its profile for approval.\n\nReview it in the Approval Queue.',
    buttonLabel: 'Review application',
    buttonUrl: 'approvalUrl',
  },

  // ── Minglers ──────────────────────────────────────────────────────────────
  {
    key: 'mingler_no_show_penalty',
    audience: 'mingler',
    name: 'No-show penalty charged',
    description: "Sent to a Mingler when seats they booked stayed empty and the restaurant's no-show penalty was charged.",
    required: false,
    placeholders: [P.name, P.restaurantName, P.eventName, P.eventDate, P.emptySeats, P.seats, P.penaltyPerSeat, P.penaltyTotal, P.bookingRef],
    subject: 'No-show penalty for {{restaurantName}} ({{bookingRef}})',
    heading: 'We missed you at {{restaurantName}}',
    body:
      'Hi {{name}},\n\n{{emptySeats}} of the {{seats}} seats you booked at {{eventName}}, {{restaurantName}} on {{eventDate}} stayed empty.\n\nUnder the restaurant\'s no-show policy we charged {{penaltyPerSeat}} for each empty seat, {{penaltyTotal}} in total, to the card you booked with.\n\nBooking reference: {{bookingRef}}',
    buttonLabel: '',
    buttonUrl: null,
  },
]

export const templateDefault = (key: string) => TEMPLATE_DEFAULTS.find((t) => t.key === key) ?? null
