'use client';

/**
 * VocabSidebar.js
 *
 * Just-in-Time vocabulary mini-card overlay.
 * Slides up at the bottom of the screen when HiAlice uses a word
 * that appears in the VOCAB_HINTS dictionary and has not been shown yet
 * this session (Krashen's i+1 principle).
 *
 * Delegates all rendering to the shared VocabMiniCard component; this
 * module only wires the session state (vocabCard / setVocabCard) to it.
 */

import VocabMiniCard from '@/components/VocabMiniCard';
import { useSession } from './SessionContext';

export default function VocabSidebar() {
  const { vocabCard, setVocabCard } = useSession();

  if (!vocabCard) return null;

  return (
    <VocabMiniCard
      word={vocabCard.word}
      definition={vocabCard.definition}
      example={vocabCard.example}
      onDismiss={() => setVocabCard(null)}
    />
  );
}
