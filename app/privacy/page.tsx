export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-16">

        <p className="text-xs text-gray-400 tracking-widest uppercase mb-4">Legal</p>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-12">Last updated: April 26, 2026</p>

        <div className="space-y-10 text-gray-700 text-base leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-black mb-3">Who we are</h2>
            <p>
              Ask Elijah is operated by Elijah Bryant under Consistency Club. We built this platform so young basketball players can get real, experience-backed answers to their game questions. If you have questions about this policy, contact us at{' '}
              <a href="mailto:hello@consistencyclub.com" className="underline hover:text-black transition-colors">
                hello@consistencyclub.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-black mb-3">Children under 13 — COPPA</h2>
            <p>
              Ask Elijah is intended for users who are 13 years of age or older. We do not knowingly collect personal information from children under 13. Our platform requires users to confirm they are at least 13 before submitting an email address or creating an account. If we learn that we have collected personal information from a child under 13 without parental consent, we will delete that information as quickly as possible. If you believe we may have any information from or about a child under 13, please contact us at{' '}
              <a href="mailto:hello@consistencyclub.com" className="underline hover:text-black transition-colors">
                hello@consistencyclub.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-black mb-3">What we collect</h2>
            <p className="mb-4">We collect only what we need to make the product work:</p>
            <ul className="space-y-2 pl-4 border-l-2 border-gray-100">
              <li><span className="font-semibold text-black">Questions you ask.</span> Stored so we can send you your answer recap and improve the product.</li>
              <li><span className="font-semibold text-black">Email address.</span> Collected when you choose to receive your answer by email or sign in. Used to send your daily recap and authenticate your account.</li>
              <li><span className="font-semibold text-black">Profile information.</span> Name, age, position, level, goals, and struggles — collected optionally to personalize your experience. You can skip all of it.</li>
              <li><span className="font-semibold text-black">Locker room memory.</span> We may remember details you share, such as your goals, recent setbacks, position, level, and what you are working on, so future answers can understand your context.</li>
              <li><span className="font-semibold text-black">Reflections and feedback.</span> If you tell us whether an answer helped or what happened after trying it, we save that to improve future answers and product quality.</li>
              <li><span className="font-semibold text-black">IP address.</span> Collected for rate limiting and abuse prevention only.</li>
              <li><span className="font-semibold text-black">Browser language.</span> Detected automatically so we can respond in your language.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-black mb-3">What we do not collect</h2>
            <p>
              We do not sell your data. We do not run ads. We do not track you across other websites. We do not share your personal information with third parties except as described below.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-black mb-3">How we use your information</h2>
            <ul className="space-y-2 pl-4 border-l-2 border-gray-100">
              <li>To answer your questions using AI grounded in Elijah&apos;s real content.</li>
              <li>To send you your daily answer recap email when you opt in.</li>
              <li>To personalize answers based on your profile (age, level, goals).</li>
              <li>To remember context you gave us so your locker room gets more useful over time.</li>
              <li>To identify answers that helped players and improve future answers.</li>
              <li>To prevent abuse and spam.</li>
              <li>To improve the product over time.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-black mb-3">Early access and AI review</h2>
            <p>
              Ask Elijah is an early-access product. AI helps draft and organize answers using Elijah&apos;s content, your context, and relevant sources when needed. Final approved answers are reviewed before they are sent. The product is still improving, so if something looks wrong, report it and we will review it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-black mb-3">Third-party services</h2>
            <p className="mb-4">We use the following services to operate Ask Elijah. Each has its own privacy policy.</p>
            <ul className="space-y-2 pl-4 border-l-2 border-gray-100">
              <li><span className="font-semibold text-black">Supabase</span> — stores your questions, email, and profile securely.</li>
              <li><span className="font-semibold text-black">Anthropic (Claude)</span> — powers the AI answers. Your question is sent to Anthropic to generate a response.</li>
              <li><span className="font-semibold text-black">Resend</span> — sends your daily recap email.</li>
              <li><span className="font-semibold text-black">Pinecone / Voyage AI</span> — used to search Elijah&apos;s content for relevant context. Your question is sent to these services in anonymized form.</li>
              <li><span className="font-semibold text-black">Vercel</span> — hosts the application.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-black mb-3">Email communications</h2>
            <p>
              If you provide your email, we will use it to send you your daily answer recap, product updates, and occasional messages from Elijah about the Consistency Club. By submitting your email, you agree that we may contact you for these purposes. You can opt out at any time by replying to any email with &ldquo;unsubscribe&rdquo; or by contacting us directly. We will never sell your email to anyone.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-black mb-3">Data retention</h2>
            <p>
              We keep your questions, profile, locker room memory, reflections, and feedback for as long as your account is active or as long as needed to operate the service. If you want your data deleted, email us at{' '}
              <a href="mailto:hello@consistencyclub.com" className="underline hover:text-black transition-colors">
                hello@consistencyclub.com
              </a>{' '}
              from the email address connected to your account and we will remove personal data within 30 days unless we need to keep limited records for legal, security, or abuse-prevention reasons.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-black mb-3">Your rights</h2>
            <p>
              You have the right to access, correct, export, or delete your personal data at any time. If you are in the European Union or California, you have additional rights under GDPR and CCPA respectively. To exercise any of these rights, contact us at{' '}
              <a href="mailto:hello@consistencyclub.com" className="underline hover:text-black transition-colors">
                hello@consistencyclub.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-black mb-3">Cookies</h2>
            <p>
              We use session cookies only to keep you signed in. We do not use advertising cookies or third-party tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-black mb-3">Changes to this policy</h2>
            <p>
              If we make material changes to this policy, we will update the date at the top of this page. Continued use of Ask Elijah after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-black mb-3">Contact</h2>
            <p>
              Questions about this policy? Email us at{' '}
              <a href="mailto:hello@consistencyclub.com" className="underline hover:text-black transition-colors">
                hello@consistencyclub.com
              </a>.
            </p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-gray-100">
          <a href="/" className="text-sm text-gray-400 hover:text-black transition-colors">← Back to Ask Elijah</a>
        </div>

      </div>
    </div>
  )
}
