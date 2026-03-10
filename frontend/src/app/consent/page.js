'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function ConsentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parentEmail = searchParams.get('email') || '';

  const [agreed, setAgreed] = useState(false);
  const [agreedDataCollection, setAgreedDataCollection] = useState(false);
  const [agreedVoice, setAgreedVoice] = useState(false);
  const [parentName, setParentName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const allAgreed = agreed && agreedDataCollection && agreedVoice && parentName.trim().length > 2;

  const handleSubmit = async () => {
    if (!allAgreed) return;
    setSubmitting(true);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const r = await fetch(`${API}/api/auth/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentEmail,
          parentName: parentName.trim(),
          consentGiven: true,
          consentTimestamp: new Date().toISOString(),
          consentVersion: '1.0'
        })
      });
      if (!r.ok) throw new Error('Consent recording failed');
      router.push('/');
    } catch (e) {
      setError('Failed to record consent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-4">
        {/* Header */}
        <div className="text-center">
          <div className="text-6xl mb-3">🔒</div>
          <h1 className="text-2xl font-bold text-[#2C4A2E]">Parent Consent Required</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Under COPPA (Children&apos;s Online Privacy Protection Act), we need your consent
            before your child can use HiAlice.
          </p>
        </div>

        {/* What we collect */}
        <div className="bg-white/80 rounded-2xl border border-[#D4C5A9] p-5 shadow-sm">
          <h2 className="font-bold text-[#2C4A2E] mb-3">What We Collect</h2>
          <ul className="space-y-2 text-sm text-[#4B5563]">
            <li className="flex gap-2">
              <span className="text-green-500 flex-shrink-0">✓</span>
              <span>Reading session conversation data (to generate AI feedback)</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-500 flex-shrink-0">✓</span>
              <span>Vocabulary words used during sessions (to track learning progress)</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-500 flex-shrink-0">✓</span>
              <span>Voice recordings during sessions (processed, not stored permanently)</span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-400 flex-shrink-0">✗</span>
              <span>We do NOT sell or share data with third parties</span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-400 flex-shrink-0">✗</span>
              <span>We do NOT use data for advertising</span>
            </li>
          </ul>
        </div>

        {/* Parent name */}
        <div className="bg-white/80 rounded-2xl border border-[#D4C5A9] p-5 shadow-sm">
          <label className="block text-sm font-medium text-[#2C4A2E] mb-2">
            Your Full Name (Legal Guardian)
          </label>
          <input
            type="text"
            value={parentName}
            onChange={e => setParentName(e.target.value)}
            placeholder="Enter your full legal name"
            className="w-full border border-[#D4C5A9] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A7C59]/30"
          />
        </div>

        {/* Consent checkboxes */}
        <div className="bg-white/80 rounded-2xl border border-[#D4C5A9] p-5 shadow-sm space-y-4">
          {[
            {
              id: 'general',
              state: agreed,
              setter: setAgreed,
              label: 'I am the parent or legal guardian and I consent to my child using HiAlice',
              required: true
            },
            {
              id: 'data',
              state: agreedDataCollection,
              setter: setAgreedDataCollection,
              label: "I consent to the collection of my child's reading session data as described above",
              required: true
            },
            {
              id: 'voice',
              state: agreedVoice,
              setter: setAgreedVoice,
              label: 'I consent to voice processing for the speech-to-text feature (audio not permanently stored)',
              required: true
            }
          ].map(item => (
            <label key={item.id} className="flex gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={item.state}
                onChange={e => item.setter(e.target.checked)}
                className="w-5 h-5 mt-0.5 accent-[#4A7C59] cursor-pointer flex-shrink-0"
              />
              <span className="text-sm text-[#4B5563]">
                {item.label}
                {item.required && <span className="text-red-400 ml-1">*</span>}
              </span>
            </label>
          ))}
        </div>

        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!allAgreed || submitting}
          className="w-full bg-[#4A7C59] text-white rounded-2xl py-4 font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {submitting ? 'Recording consent...' : 'I Give My Consent'}
        </button>

        <p className="text-center text-xs text-[#9CA3AF]">
          By clicking above, you electronically sign this consent form.
          You can withdraw consent at any time by contacting us at privacy@hialice.com
        </p>

        <a href="/privacy-policy" className="block text-center text-xs text-[#4A7C59] underline">
          Read our full Privacy Policy
        </a>
      </div>
    </div>
  );
}

export default function ConsentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center"><p className="text-[#6B7280]">Loading...</p></div>}>
      <ConsentForm />
    </Suspense>
  );
}
