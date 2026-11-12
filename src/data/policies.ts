/** The policies linked under the sign-in card. Taken from the Geosys policy pages (digigos.co.in). */
export interface PolicySection {
  title: string
  /** Paragraphs before the list. */
  text?: string[]
  /** A bulleted list. */
  items?: string[]
}

export interface Policy {
  title: string
  sections: PolicySection[]
}

export type PolicyKey = 'terms' | 'privacy' | 'refund'

export const POLICIES: Record<PolicyKey, Policy> = {
  terms: {
    title: 'Terms & Conditions',
    sections: [
      {
        title: '1.1 Introduction',
        text: [
          'These Terms & Conditions govern the use of this digital platform and its related services. The platform provides tools for managing personal information, digital contact cards, reminders, events, tasks, and financial tracking.',
          'By accessing or using the platform, you agree to comply with these Terms. If you do not agree with these Terms, you should discontinue use of the services.',
        ],
      },
      {
        title: '1.2 User Eligibility',
        items: [
          'Users must provide accurate and complete information during registration.',
          'You are responsible for maintaining the confidentiality of your login credentials.',
          'You agree not to share your account access with unauthorized persons.',
        ],
      },
      {
        title: '1.3 Services Provided',
        text: ['The platform may provide the following services:'],
        items: [
          'Creation and sharing of digital contact or visiting cards',
          'QR code-based contact sharing',
          'Task, reminder, and event management tools',
          'Birthday or important date notifications',
          'Personal income and expense tracking features',
          'Data visualization such as charts and financial summaries',
          'Optional payment-related services where applicable',
        ],
      },
      {
        title: '1.4 User Responsibilities',
        text: ['You agree to:'],
        items: [
          'Provide accurate and updated information when using the platform',
          'Use the services only for lawful purposes',
          'Not attempt unauthorized access to other accounts or system data',
          'Not misuse the platform for fraudulent or harmful activities',
        ],
      },
      {
        title: '1.5 Payments',
        items: [
          'Payments made through the platform may be processed via third-party payment providers.',
          'The platform acts only as a facilitator and does not store sensitive card or banking details.',
          'Users must verify payment details before completing transactions.',
          'The platform is not responsible for payment failures caused by banks, payment gateways, or network issues.',
        ],
      },
      {
        title: '1.6 Notifications',
        items: [
          'The platform may send reminders, alerts, or notifications related to tasks, events, or system updates.',
          'Users may manage notification preferences through application settings where available.',
        ],
      },
      {
        title: '1.7 Data Accuracy',
        items: [
          'Users are responsible for ensuring the accuracy of the information they enter.',
          'The platform is not responsible for incorrect data, records, or financial information entered by users.',
        ],
      },
      {
        title: '1.8 Limitation of Liability',
        text: ['The platform shall not be liable for:'],
        items: [
          'Loss of data due to user actions or device issues',
          'Financial decisions made based on recorded data or analytics',
          'Service interruptions, downtime, or technical issues',
          'Errors caused by third-party service providers',
        ],
      },
      {
        title: '1.9 Account Suspension or Termination',
        items: [
          'Accounts may be suspended or terminated if misuse or violation of these Terms is detected.',
          'Users may stop using the platform at any time by discontinuing use or requesting account deletion.',
        ],
      },
      {
        title: '1.10 Changes to Terms',
        text: ['These Terms may be updated periodically. Continued use of the platform after changes indicates acceptance of the revised Terms.'],
      },
      {
        title: '1.11 Governing Law',
        text: ['These Terms shall be governed by and interpreted in accordance with the applicable laws and regulations of the jurisdiction in which the platform operates.'],
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      {
        title: '1.1 Introduction',
        text: ['We respect your privacy and are committed to protecting your personal information. This Privacy Policy explains how information is collected, used, and protected when using this platform and its related services.'],
      },
      {
        title: '1.2 Information We Collect',
        text: ['The platform may collect the following types of information:'],
        items: [
          'Basic personal details such as name, phone number, and email address',
          'Profile information used for creating and sharing digital contact cards',
          'Event, reminder, or task information entered by users',
          'Financial tracking data such as income or expense records entered by users',
          'Device information, browser type, and usage analytics',
          'Transaction references for payments (no card or banking credentials are stored)',
        ],
      },
      {
        title: '1.3 How We Use Information',
        text: ['The collected information may be used to:'],
        items: [
          'Provide and maintain platform services',
          'Enable digital contact sharing and QR code features',
          'Manage reminders, events, and task notifications',
          'Allow users to track personal financial records and analytics',
          'Improve service functionality, performance, and user experience',
          'Communicate service updates, alerts, or important notifications',
        ],
      },
      {
        title: '1.4 Data Sharing',
        text: ['Personal data is not sold or rented to third parties. Information may only be shared in the following situations:'],
        items: [
          'With service providers that help operate the platform (such as payment processors or notification services)',
          'With users or contacts when information is intentionally shared through digital card or QR features',
          'When required by law, legal process, or regulatory authorities',
        ],
      },
      {
        title: '1.5 Data Security',
        text: ['Appropriate technical and organizational security measures are implemented to protect user data from unauthorized access, misuse, or disclosure. However, no digital system can guarantee complete security.'],
      },
      {
        title: '1.6 User Rights',
        text: ['Users have the ability to:'],
        items: [
          'Update or modify their profile information',
          'Edit or delete reminders, tasks, and financial records they create',
          'Request correction of inaccurate information',
          'Request account deletion, subject to legal or operational requirements',
        ],
      },
      {
        title: '1.7 Data Retention',
        text: ['Personal data will be retained only for as long as necessary to provide services, comply with legal obligations, resolve disputes, and enforce agreements.'],
      },
      {
        title: '1.8 Third-Party Services',
        text: ['The platform may use third-party services such as payment gateways, analytics tools, and push notification providers. These services may collect limited information as required to perform their functions, and their own privacy policies may apply.'],
      },
      {
        title: '1.9 Changes to This Policy',
        text: ['This Privacy Policy may be updated periodically to reflect service improvements or legal requirements. Updated versions will be made available within the platform.'],
      },
      {
        title: '1.10 Contact',
        text: ['For questions or concerns regarding privacy or data handling, please contact the platform administrator or the support email provided within the application.'],
      },
    ],
  },
  refund: {
    title: 'Refund Policy',
    sections: [
      {
        title: '1.1 General Policy',
        text: [
          'Payments made through this platform are generally non-refundable unless stated otherwise.',
          'The platform acts as a digital service provider that enables users to manage personal information, reminders, events, and financial tracking tools. Any payments made for services or memberships facilitated through the platform are subject to the policies of the respective service provider or organization.',
        ],
      },
      {
        title: '1.2 Eligible Refund Cases',
        text: ['Refunds may be considered under the following circumstances:'],
        items: [
          'Duplicate payments made unintentionally.',
          'Incorrect payment amount due to a system or technical error.',
          'Technical failure during the payment process resulting in multiple charges.',
          'Unauthorized transactions reported within a reasonable time.',
        ],
      },
      {
        title: '1.3 Non-Refundable Cases',
        text: ['Refund requests will not be accepted in the following situations:'],
        items: [
          'Payments made voluntarily by users for services or subscriptions.',
          'Charges that have already been processed and fulfilled.',
          'Delays or issues caused by banks, payment gateways, or third-party providers.',
          'Failure to use the services after payment.',
        ],
      },
      {
        title: '1.4 Refund Process',
        items: [
          'Users must submit a refund request with transaction details.',
          'The request will be reviewed and verified by the responsible administrator or service provider.',
          'If approved, refunds will be processed using the original payment method whenever possible.',
          'Refund processing may take approximately 7–14 business days depending on the payment provider.',
        ],
      },
      {
        title: '1.5 Payment Gateway Charges',
        text: ['Any transaction or processing fees charged by payment gateways or financial institutions may be deducted from the refundable amount where applicable.'],
      },
      {
        title: '1.6 Contact for Refund Requests',
        text: ['For any refund-related queries or requests, please contact the platform administrator or reach out through the official support email provided within the application.'],
      },
    ],
  },
}
