export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <p className="text-xs text-gray-400 tracking-widest uppercase mb-4">Legal</p>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Terms of Use</h1>
        <p className="text-sm text-gray-400 mb-12">Last updated: April 26, 2026</p>

        <div className="space-y-10 text-gray-700 text-base leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-black mb-3">What this is</h2>
            <p>
              Ask Elijah gives basketball players experience-backed guidance from Elijah Bryant&apos;s perspective.
              It is mentorship and educational content. It is not medical, legal, financial, recruiting-compliance,
              NCAA, NIL, or mental-health treatment advice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-black mb-3">Who can use it</h2>
            <p>
              You must be at least 13 years old to use Ask Elijah. If you are under 18, use the service with a parent
              or guardian&apos;s awareness. Do not submit private information about other people without permission.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-black mb-3">Use the answers responsibly</h2>
            <p>
              Basketball guidance can help you think and train better, but you are responsible for your choices.
              For injuries, medical issues, eligibility, NIL, recruiting rules, scholarships, contracts, or school
              compliance, confirm with a qualified professional, doctor, trainer, coach, school, or compliance office.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-black mb-3">Early access</h2>
            <p>
              This product is still being built. Features may change, answers may be updated, and access may be limited
              to protect quality and cost. If something breaks, use the report button or contact us.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-black mb-3">Your content</h2>
            <p>
              You own the questions, reflections, and profile information you submit. By submitting them, you allow us
              to use that information to answer you, personalize your locker room, improve the product, and operate the
              service. Public community answers may be shown without exposing your private profile details.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-black mb-3">Abuse</h2>
            <p>
              Do not spam the service, attempt to bypass rate limits, scrape private data, submit abusive content, or
              interfere with the app. We may block, limit, or remove access if needed to protect the product or users.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-black mb-3">Contact</h2>
            <p>
              Questions about these terms? Email{' '}
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

