import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — The Card Doc",
  description:
    "Privacy Policy for The Card Doc LLC covering our Instagram and Messenger messaging assistant and card restoration services.",
  robots: { index: true, follow: true },
  alternates: {
    canonical: "https://thecarddoc1.com/privacy",
  },
};

export default function PrivacyPage() {
  const EFFECTIVE_DATE = "September 22, 2026";
  const CONTACT_EMAIL = "thecarddoc1@gmail.com";

  return (
    <div className="min-h-screen bg-white py-16">
      <div className="max-w-4xl mx-auto px-6 md:px-10">
        <h1 className="font-heading text-4xl font-bold text-foreground mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground mb-2">
          Effective Date: {EFFECTIVE_DATE}
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          Published by <strong>The Card Doc LLC</strong>, a New Jersey limited liability company
          doing business as &ldquo;The Card Doc&rdquo;
        </p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">

          {/* ─── Overview ──────────────────────────────────────────────────────── */}
          <section>
            <h2 className="text-2xl font-bold font-heading mt-8 mb-4">Overview</h2>
            <p>
              This Privacy Policy describes how <strong>The Card Doc LLC</strong>
              (&ldquo;The Card Doc,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;)
              collects, uses, shares, and protects personal information when you interact with us
              through our website at{" "}
              <a href="https://thecarddoc1.com" className="text-primary underline underline-offset-2">
                thecarddoc1.com
              </a>
              , our Instagram account{" "}
              <a
                href="https://www.instagram.com/the_card_doc"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                @the_card_doc
              </a>
              , or through our automated Instagram and Messenger Direct Message (DM) assistant
              (our &ldquo;Messenger App&rdquo;).
            </p>
            <p>
              This is <em>our own</em> policy. It is not Meta&rsquo;s policy, ManyChat&rsquo;s
              policy, or any other party&rsquo;s policy. The Card Doc LLC is the publisher of and
              data controller responsible for this policy. Where we reference Meta&rsquo;s own
              privacy policies it is as a supplementary reference only&mdash;those third-party
              policies govern Meta&rsquo;s separate data practices, not ours.
            </p>
            <p>
              By sending us a message, placing an order, or visiting our website, you agree to the
              practices described in this Privacy Policy.
            </p>
          </section>

          {/* ─── 1. Information We Collect ─────────────────────────────────────── */}
          <section>
            <h2 className="text-2xl font-bold font-heading mt-8 mb-4">
              1. Information We Collect
            </h2>

            <h3 className="text-lg font-bold mt-6 mb-2">A. Information You Provide Directly</h3>
            <p>
              When you send us a message on Instagram or Messenger, or place an order on our
              website, we collect:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-sm">
              <li>
                <strong>Message content:</strong> the full text of every message you send us,
                including questions, order inquiries, complaints, and any other content you choose
                to include
              </li>
              <li>
                <strong>Photos, videos, and attachments:</strong> any media files you send us
                (for example, photos of your cards for damage assessment)
              </li>
              <li>
                <strong>Contact and order details:</strong> your name, email address, phone number,
                shipping address, order number, and any other information you provide in the course
                of placing or tracking a restoration order
              </li>
            </ul>

            <h3 className="text-lg font-bold mt-6 mb-2">
              B. Information Received from Meta via the Instagram and Messenger APIs
            </h3>
            <p>
              When you message us through Instagram Direct or Facebook Messenger, Meta provides us
              with certain information about you through the Instagram Graph API and Messenger
              Platform API, including:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-sm">
              <li>
                <strong>User identifier:</strong> your Instagram-scoped user ID or Page-scoped
                user ID (a unique, non-human-readable number assigned by Meta to identify your
                account within our app)
              </li>
              <li>
                <strong>Username and display name:</strong> your Instagram username and/or
                Facebook display name as shown on your profile
              </li>
              <li>
                <strong>Profile picture:</strong> the publicly available profile photo associated
                with your account
              </li>
              <li>
                <strong>Message metadata:</strong> timestamps of messages, message delivery status
                (sent, delivered), and read receipts where the API makes these available
              </li>
            </ul>
            <p>
              We receive only the data Meta&rsquo;s API provides through the permissions our
              Messenger App has been granted. We do not request or store permissions beyond what is
              necessary to operate the DM assistant. For details on how Meta collects and uses your
              data, see{" "}
              <a
                href="https://www.facebook.com/privacy/policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                Meta&rsquo;s Privacy Policy
              </a>
              .
            </p>

            <h3 className="text-lg font-bold mt-6 mb-2">C. Information Collected Automatically</h3>
            <p>
              When you use our website or our messaging integrations, we may automatically collect:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-sm">
              <li>
                <strong>Server logs:</strong> IP addresses, request times, pages visited, HTTP
                status codes, and error reports
              </li>
              <li>
                <strong>Messaging usage information:</strong> which automated replies were sent,
                which message flows were triggered, and response times
              </li>
              <li>
                <strong>Device and browser information:</strong> browser type, operating system,
                device type, and language settings when you visit our website
              </li>
            </ul>
          </section>

          {/* ─── 2. How We Use Your Information ───────────────────────────────── */}
          <section>
            <h2 className="text-2xl font-bold font-heading mt-8 mb-4">
              2. How We Use Your Information
            </h2>
            <p>
              We use the information we collect only for the following purposes. Each purpose is
              listed with the type of data used and the reason it is necessary:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-sm">
              <li>
                <strong>Replying to your messages:</strong> message text, user ID, username, and
                message metadata are used to generate and send automated or human replies to your
                questions and requests. This is the core function of our Messenger App.
              </li>
              <li>
                <strong>Routing to a human team member:</strong> message content including photos
                and attachments is routed to a human when the automated system cannot handle the
                request, or when the message relates to a damage assessment, refund, complaint, or
                other matter requiring personal attention.
              </li>
              <li>
                <strong>Providing restoration and order services:</strong> name, email, phone,
                shipping address, and order details are used to process your card restoration
                order, communicate its status, ship completed cards, and issue receipts and
                refunds.
              </li>
              <li>
                <strong>Improving reply accuracy:</strong> aggregated and anonymized data about
                which automated replies were triggered and whether they were helpful is used to
                improve the quality and relevance of future responses.
              </li>
              <li>
                <strong>Security and abuse prevention:</strong> server logs, user IDs, and usage
                data are used to detect spam, fraud, and policy violations, and to maintain the
                integrity of our services.
              </li>
              <li>
                <strong>Legal compliance:</strong> we retain certain records as required by
                applicable law (for example, transaction records for tax purposes) and may use
                your information to respond to lawful requests from courts or government agencies.
              </li>
            </ul>
            <p className="font-semibold mt-4">
              We do <em>not</em> sell your personal information. We do not use your messages or
              personal information for advertising, or send you promotional messages that you have
              not consented to receive.
            </p>
          </section>

          {/* ─── 3. AI-Generated Replies ───────────────────────────────────────── */}
          <section>
            <h2 className="text-2xl font-bold font-heading mt-8 mb-4">
              3. AI-Generated Replies
            </h2>
            <p>
              Some replies you receive from our Instagram or Messenger DM assistant may be
              generated, in whole or in part, by an artificial intelligence (AI) language model.
              When this occurs:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-sm">
              <li>
                The content of your message (text, and in some cases photos) is sent to
                Anthropic&rsquo;s API (the provider of the Claude AI model) solely for the purpose
                of generating a reply. See Section 5 (Service Providers) for more details.
              </li>
              <li>
                Your messages are <strong>not used to train AI models.</strong> Anthropic&rsquo;s
                API terms prohibit using customer API inputs and outputs to train their models
                without explicit opt-in consent, and we have not provided such consent.
              </li>
              <li>
                If you would prefer to speak with a human at any time, simply reply &ldquo;human&rdquo; or
                &ldquo;agent,&rdquo; or contact us directly at{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">
                  {CONTACT_EMAIL}
                </a>
                .
              </li>
            </ul>
          </section>

          {/* ─── 4. Cookies and Tracking ──────────────────────────────────────── */}
          <section>
            <h2 className="text-2xl font-bold font-heading mt-8 mb-4">
              4. Cookies and Analytics
            </h2>
            <p>
              Our website uses Google Analytics (via Google Tag Manager) to collect aggregate
              information about site usage such as page views, traffic sources, and session
              duration. This data is collected using cookies and similar tracking technologies.
              Google Analytics data is anonymized and used only to understand how visitors use our
              site.
            </p>
            <p>
              We use session cookies necessary for authentication (for example, to keep you logged
              in to your account). We do not use cookies for cross-site advertising tracking.
            </p>
          </section>

          {/* ─── 5. Service Providers ─────────────────────────────────────────── */}
          <section>
            <h2 className="text-2xl font-bold font-heading mt-8 mb-4">
              5. Who We Share Your Information With
            </h2>
            <p>
              We share personal information only with service providers who help us operate our
              business, under contractual obligations to protect it, and only to the extent
              necessary. We do not sell data. Our current service providers are:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-sm">
              <li>
                <strong>Meta Platforms, Inc.</strong> — we use the Instagram Graph API and
                Messenger Platform API to send and receive messages. Meta processes message
                metadata in accordance with{" "}
                <a
                  href="https://www.facebook.com/privacy/policy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  Meta&rsquo;s Privacy Policy
                </a>
                .
              </li>
              <li>
                <strong>ManyChat</strong> — we use ManyChat as our messaging automation platform.
                ManyChat stores conversation data, contact information, and message flows on our
                behalf.{" "}
                <a
                  href="https://manychat.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  ManyChat Privacy Policy
                </a>
                .
              </li>
              <li>
                <strong>Anthropic PBC</strong> — message content is sent to Anthropic&rsquo;s
                Claude API to generate automated replies. Anthropic processes this data subject to
                their API usage policies and does not use it to train models.{" "}
                <a
                  href="https://www.anthropic.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  Anthropic Privacy Policy
                </a>
                .
              </li>
              <li>
                <strong>Railway</strong> — we host our backend automation services on Railway&rsquo;s
                cloud infrastructure. Railway may process data in connection with hosting and
                running our server.
              </li>
              <li>
                <strong>Supabase</strong> — we use Supabase as our database and backend-as-a-service
                provider. Order records, customer information, and message-related data are stored
                in Supabase&rsquo;s managed PostgreSQL database.
              </li>
              <li>
                <strong>Pushover</strong> — we use Pushover to send internal push notifications
                to our team when certain events occur (for example, a new order or a message
                requiring human review). Limited message content may be included in these
                notifications.
              </li>
              <li>
                <strong>Legal disclosures:</strong> we may disclose personal information if
                required by law, court order, or government request, or to protect the rights,
                property, or safety of The Card Doc LLC, our customers, or others.
              </li>
              <li>
                <strong>Business transfers:</strong> if The Card Doc LLC is acquired, merged, or
                its assets are transferred to another entity, personal information may be
                transferred as part of that transaction. We will notify users by posting a notice
                on our website before data is transferred and becomes subject to a different
                privacy policy.
              </li>
            </ul>
          </section>

          {/* ─── 6. Data Retention ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-2xl font-bold font-heading mt-8 mb-4">6. Data Retention</h2>
            <p>We retain personal information for the following periods:</p>
            <ul className="list-disc pl-6 space-y-2 text-sm">
              <li>
                <strong>Conversation data</strong> (message text, contact identifiers, message
                metadata): 12 months after your last message to us.
              </li>
              <li>
                <strong>Server and error logs:</strong> 90 days.
              </li>
              <li>
                <strong>Order records:</strong> retained for at least 7 years as required for tax
                and accounting compliance, regardless of the conversation retention period.
              </li>
              <li>
                <strong>Exceptions:</strong> we retain data longer when required by applicable law,
                when there is an open order, unresolved dispute, active legal proceeding, or
                regulatory requirement that prevents deletion.
              </li>
            </ul>
            <p>
              When retention periods expire, we delete or anonymize the data. Note that deleting
              our records does not remove messages from your own Instagram or Messenger inbox —
              those remain in your Meta account and are governed by Meta&rsquo;s policies.
            </p>
          </section>

          {/* ─── 7. Data Deletion ─────────────────────────────────────────────── */}
          <section id="delete">
            <h2 className="text-2xl font-bold font-heading mt-8 mb-4">
              7. How to Request Data Deletion
            </h2>
            <p>
              You have the right to request that we delete your personal information. To submit a
              deletion request:
            </p>
            <ol className="list-decimal pl-6 space-y-3 text-sm">
              <li>
                <strong>Email us at:</strong>{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=Data%20Deletion%20Request`}
                  className="text-primary underline underline-offset-2"
                >
                  {CONTACT_EMAIL}
                </a>
              </li>
              <li>
                <strong>Subject line:</strong> use exactly <em>Data Deletion Request</em>
              </li>
              <li>
                <strong>Include in your message:</strong> your Instagram username or Facebook
                display name so we can locate your records. If you have an order number, include
                that too.
              </li>
            </ol>
            <p className="mt-4">
              We will process your request within <strong>30 days</strong> of receipt and send a
              confirmation email when deletion is complete. In some cases (for example, where we
              are required by law to retain records, or where there is an open order or active
              dispute), we may be unable to delete certain data immediately; we will explain any
              such limitations in our response.
            </p>
            <p>
              <strong>Important:</strong> deleting your records from our systems does not remove
              the conversation thread from your own Instagram or Messenger inbox. Those messages
              remain in your Meta account and must be deleted there separately.
            </p>
          </section>

          {/* ─── 8. Your Rights ───────────────────────────────────────────────── */}
          <section>
            <h2 className="text-2xl font-bold font-heading mt-8 mb-4">8. Your Privacy Rights</h2>
            <p>
              Depending on where you live, you may have the following rights regarding your
              personal information. We will not discriminate against you for exercising any of
              these rights.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-sm">
              <li>
                <strong>Access:</strong> request a copy of the personal information we hold about
                you.
              </li>
              <li>
                <strong>Correction:</strong> request that we correct inaccurate or incomplete
                information.
              </li>
              <li>
                <strong>Deletion:</strong> request that we delete your personal information
                (see Section 7 above for how to submit a deletion request).
              </li>
              <li>
                <strong>Stop messaging / block:</strong> you can stop receiving messages from our
                DM assistant at any time by replying &ldquo;STOP,&rdquo; blocking our account, or
                using Instagram&rsquo;s or Facebook&rsquo;s built-in controls to restrict or
                block our account.
              </li>
              <li>
                <strong>Request a human:</strong> at any time you may request to speak with a
                human team member rather than the automated assistant. Reply &ldquo;human&rdquo;
                or &ldquo;agent&rdquo; in the chat, or email us directly.
              </li>
            </ul>

            <h3 className="text-lg font-bold mt-6 mb-2">New Jersey Residents</h3>
            <p>
              If you are a resident of New Jersey, the{" "}
              <strong>New Jersey Data Privacy Act (NJDPA)</strong> grants you additional rights,
              including the right to opt out of targeted advertising, the right to opt out of the
              sale of personal data (we do not sell personal data), the right to appeal a decision
              we make regarding your request, and the right to data portability. To exercise these
              rights or to file an appeal, contact us at{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-primary underline underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>

            <h3 className="text-lg font-bold mt-6 mb-2">Other State Laws</h3>
            <p>
              Residents of California, Virginia, Colorado, Connecticut, and other states with
              comprehensive privacy laws may have similar rights. We honor access, correction, and
              deletion requests from all users regardless of location. Contact us using the
              information in Section 11 to exercise your rights.
            </p>
          </section>

          {/* ─── 9. Security ──────────────────────────────────────────────────── */}
          <section>
            <h2 className="text-2xl font-bold font-heading mt-8 mb-4">9. Security</h2>
            <p>
              We implement commercially reasonable administrative, technical, and physical
              safeguards to protect your personal information from unauthorized access, disclosure,
              alteration, and destruction. These include:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-sm">
              <li>Encrypted connections (HTTPS/TLS) for all data transmission</li>
              <li>Access controls limiting who on our team can view customer data</li>
              <li>Secure database hosting with row-level security policies</li>
              <li>API keys and credentials stored as environment variables, never in source code</li>
            </ul>
            <p>
              No method of electronic transmission or storage is 100% secure. If you believe your
              information has been compromised, please contact us immediately at{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-primary underline underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

          {/* ─── 10. Children ─────────────────────────────────────────────────── */}
          <section>
            <h2 className="text-2xl font-bold font-heading mt-8 mb-4">10. Children&rsquo;s Privacy</h2>
            <p>
              Our services are not directed to children under the age of 13. We do not knowingly
              collect personal information from children under 13. If we learn that we have
              inadvertently collected personal information from a child under 13, we will delete it
              promptly in accordance with the Children&rsquo;s Online Privacy Protection Act
              (COPPA). If you believe we may have collected information from a child under 13,
              please contact us at{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-primary underline underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

          {/* ─── 11. International Transfers ──────────────────────────────────── */}
          <section>
            <h2 className="text-2xl font-bold font-heading mt-8 mb-4">
              11. Data Processing Location
            </h2>
            <p>
              The Card Doc LLC is based in New Jersey, USA. All personal information we collect is
              processed and stored in the United States. Our service providers (Supabase, Railway,
              Anthropic, ManyChat) also process data in the US or in jurisdictions with data
              protection agreements. By using our services from outside the United States, you
              consent to the transfer and processing of your information in the US.
            </p>
          </section>

          {/* ─── 12. Changes ──────────────────────────────────────────────────── */}
          <section>
            <h2 className="text-2xl font-bold font-heading mt-8 mb-4">
              12. Changes to This Privacy Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our
              practices, services, or applicable law. When we make material changes, we will:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-sm">
              <li>Update the &ldquo;Effective Date&rdquo; at the top of this page</li>
              <li>Post a notice on our website or send a message through our DM channels</li>
            </ul>
            <p>
              We encourage you to review this page periodically. Continued use of our services
              after a policy update constitutes acceptance of the revised policy.
            </p>
          </section>

          {/* ─── 13. Contact ──────────────────────────────────────────────────── */}
          <section>
            <h2 className="text-2xl font-bold font-heading mt-8 mb-4">13. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, want to exercise your rights, or
              need to report a concern, contact us by any of the following means:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-sm">
              <li>
                <strong>Email:</strong>{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-primary underline underline-offset-2"
                >
                  {CONTACT_EMAIL}
                </a>{" "}
                (monitored; we reply within 1 business day)
              </li>
              <li>
                <strong>Instagram DM:</strong>{" "}
                <a
                  href="https://www.instagram.com/the_card_doc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  @the_card_doc
                </a>
              </li>
              <li>
                <strong>Legal name:</strong> The Card Doc LLC
              </li>
              <li>
                <strong>State of formation:</strong> New Jersey, USA
              </li>
            </ul>
          </section>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-12">
            <p className="text-sm font-semibold text-foreground mb-2">
              QUICK REFERENCE — DATA DELETION
            </p>
            <p className="text-sm text-foreground">
              To request deletion of your data, email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=Data%20Deletion%20Request`}
                className="text-primary underline underline-offset-2 font-semibold"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              with subject line <em>Data Deletion Request</em> and your Instagram username or
              Facebook name. We will complete deletion within 30 days and confirm by email.
              See <a href="#delete" className="text-primary underline underline-offset-2">Section 7</a> for full
              instructions.
            </p>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-12">
            &copy; {new Date().getFullYear()} The Card Doc LLC. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
