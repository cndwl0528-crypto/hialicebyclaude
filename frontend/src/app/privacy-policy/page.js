'use client';
export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#F5F0E8] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <a href="/" className="text-[#4A7C59] text-sm flex items-center gap-1 mb-6">← Back to Home</a>

        <h1 className="text-3xl font-bold text-[#2C4A2E] mb-2">Privacy Policy</h1>
        <p className="text-sm text-[#9CA3AF] mb-8">Last updated: March 2026 | Version 1.0</p>

        <div className="space-y-8 text-[#4B5563]">
          <section>
            <h2 className="text-xl font-bold text-[#2C4A2E] mb-3">COPPA Compliance Statement</h2>
            <p className="leading-relaxed">
              HiAlice is committed to protecting the privacy of children. We comply with the
              Children&apos;s Online Privacy Protection Act (COPPA). We do not knowingly collect
              personal information from children under 13 without verifiable parental consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#2C4A2E] mb-3">What Information We Collect</h2>
            <ul className="list-disc list-inside space-y-2 leading-relaxed">
              <li>Parent/guardian email address (for account creation)</li>
              <li>Child&apos;s first name and age (to personalize learning)</li>
              <li>Reading session conversation data (to provide AI tutoring feedback)</li>
              <li>Vocabulary words used in sessions (to track learning progress)</li>
              <li>Voice input during sessions (processed in real-time, not permanently stored)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#2C4A2E] mb-3">How We Use Information</h2>
            <ul className="list-disc list-inside space-y-2 leading-relaxed">
              <li>To provide personalized AI reading tutoring</li>
              <li>To track and display learning progress to parents</li>
              <li>To improve our AI tutoring quality</li>
              <li>We do NOT use data for advertising</li>
              <li>We do NOT sell data to third parties</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#2C4A2E] mb-3">Parental Rights</h2>
            <p className="leading-relaxed">Parents may at any time:</p>
            <ul className="list-disc list-inside space-y-2 mt-2 leading-relaxed">
              <li>Review the personal information collected about their child</li>
              <li>Request deletion of their child&apos;s data</li>
              <li>Withdraw consent and discontinue collection</li>
              <li>
                Contact us at:{' '}
                <a href="mailto:privacy@hialice.com" className="text-[#4A7C59] underline">
                  privacy@hialice.com
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#2C4A2E] mb-3">Data Security</h2>
            <p className="leading-relaxed">
              All data is encrypted in transit (HTTPS/TLS) and at rest. We use Supabase
              with Row Level Security policies to ensure each parent can only access their
              own children&apos;s data. Conversation logs are retained for 2 years and then
              automatically deleted.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#2C4A2E] mb-3">Contact Us</h2>
            <p className="leading-relaxed">
              For privacy concerns or to exercise your parental rights:<br />
              <a href="mailto:privacy@hialice.com" className="text-[#4A7C59] underline">
                privacy@hialice.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
