'use client';

import { useState } from 'react';

// Mock prompt data
const DEFAULT_SYSTEM_PROMPT = `You are HiAlice, a warm and encouraging English teacher from the East Coast.
You're talking with a [LEVEL] student who just finished reading "[BOOK_TITLE]".

GUIDELINES:
- Use the Socratic method: Ask questions instead of giving answers
- Match vocabulary and sentence complexity to the student's level
- Praise effort and creativity, not just correctness
- Guide students to express their own thoughts and feelings
- Current session stage: [STAGE]
- In BODY stage, help student provide 3 reasons with supporting details

TONE: Friendly, patient, curious, encouraging

RESPONSE INSTRUCTIONS:
- Keep responses under 100 words for Beginner
- Keep responses under 150 words for Intermediate
- Keep responses under 200 words for Advanced
- Always ask a follow-up question to keep the conversation going
- Acknowledge the student's effort before moving to the next point`;

const LEVEL_PROMPTS = {
  Beginner: `You are talking with a 6-8 year old student. Use simple words and short sentences.
Ask one question at a time. Use pictures/emojis to help them understand.
Celebrate their effort and be very encouraging.`,
  Intermediate: `You are talking with a 9-11 year old student. Use more complex sentence structures.
Ask questions that require explanations. Help them connect ideas together.
Encourage them to think about the author's choices.`,
  Advanced: `You are talking with a 12-13 year old student. Use sophisticated vocabulary.
Ask questions about deeper themes and character motivations.
Encourage critical thinking and personal interpretations.`,
};

const STAGE_TEMPLATES = {
  Title: `Current Stage: TITLE (Explore the title)

Main Question: "What do you think the title means? Why did the author choose this title?"

Follow-up prompts if student struggles:
1. "Does the title give you any hints about what the book is about?"
2. "How does the title make you feel?"
3. "Can you think of an alternative title for this book?"`,

  Introduction: `Current Stage: INTRODUCTION (Meet the characters)

Main Question: "Who is the main character? How would you describe them?"

Follow-up prompts if student struggles:
1. "What does the character look like?"
2. "What is the character's personality like?"
3. "How do you think the character feels at the beginning of the story?"`,

  Body: `Current Stage: BODY (Share your thoughts)

Main Question: "Can you give me three reasons why you think that? Let's start with your first reason."

Follow-up prompts:
1. First reason: "What's one reason you liked/didn't like the book?"
2. Second reason: "What's another reason? Can you find evidence in the book?"
3. Third reason: "What's your third reason? How does this connect to the story?"

Help student structure their thoughts:
- "Because..." (state the reason)
- "For example..." (provide evidence)
- "This shows..." (explain the connection)`,

  Conclusion: `Current Stage: CONCLUSION (Wrap up)

Main Question: "What did this book teach you? Would you recommend it to a friend?"

Follow-up prompts:
1. "What was the most important lesson from this book?"
2. "How did reading this book make you feel?"
3. "Who do you think would enjoy reading this book? Why?"
4. "If you could add one more chapter, what would happen?"`,
};

const MOCK_HISTORY = [
  {
    version: 3,
    date: new Date(Date.now() - 86400000).toISOString(),
    changes: 'Updated Beginner level to use simpler vocabulary',
  },
  {
    version: 2,
    date: new Date(Date.now() - 172800000).toISOString(),
    changes: 'Added emoji suggestions for visual learners',
  },
  {
    version: 1,
    date: new Date(Date.now() - 259200000).toISOString(),
    changes: 'Initial prompt creation',
  },
];

const LEVEL_TAB_STYLES = {
  Beginner: { active: { bg: '#2E7D32', text: '#FFFFFF' }, inactive: { border: '#C8E6C9' } },
  Intermediate: { active: { bg: '#E65100', text: '#FFFFFF' }, inactive: { border: '#FFE0B2' } },
  Advanced: { active: { bg: '#6A1B9A', text: '#FFFFFF' }, inactive: { border: '#E1BEE7' } },
};

export default function PromptsPage() {
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [levelPrompts, setLevelPrompts] = useState(LEVEL_PROMPTS);
  const [activeTab, setActiveTab] = useState('system');
  const [activeLevelTab, setActiveLevelTab] = useState('Beginner');
  const [activeStageTab, setActiveStageTab] = useState('Title');
  const [stageTemplates, setStageTemplates] = useState(STAGE_TEMPLATES);
  const [saveStatus, setSaveStatus] = useState('');
  const [showTestModal, setShowTestModal] = useState(false);
  const [testResponse, setTestResponse] = useState('');

  const handleSavePrompt = async () => {
    try {
      setSaveStatus('Saving...');
      setTimeout(() => {
        setSaveStatus('Saved successfully');
        setTimeout(() => setSaveStatus(''), 3000);
      }, 1000);
    } catch (error) {
      setSaveStatus('Failed to save');
    }
  };

  const handleTestPrompt = () => {
    const mockResponses = [
      "That's a wonderful observation! What else did you notice about the title?",
      "I love how you're thinking about this! Can you give me more details?",
      "That's an interesting perspective! Where did you get that idea from the book?",
    ];
    setTestResponse(mockResponses[Math.floor(Math.random() * mockResponses.length)]);
  };

  const mainTabs = [
    { key: 'system', label: 'System Prompt' },
    { key: 'levels', label: 'Level-Specific' },
    { key: 'stages', label: 'Stage Templates' },
    { key: 'history', label: 'History' },
  ];

  const stageBorderColors = {
    Title: '#5C8B5C',
    Introduction: '#87CEDB',
    Body: '#D4A843',
    Conclusion: '#7AC87A',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-[#3D2E1E]">HiAlice AI Prompt Management</h1>
      </div>

      {/* Tab Navigation */}
      <div
        className="flex gap-2 flex-wrap"
        style={{ borderBottom: '2px solid #E8DEC8' }}
      >
        {mainTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-6 py-3 font-bold transition-all border-b-4"
            style={{
              minHeight: '48px',
              color: activeTab === tab.key ? '#5C8B5C' : '#6B5744',
              borderBottomColor: activeTab === tab.key ? '#5C8B5C' : 'transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* System Prompt Tab */}
      {activeTab === 'system' && (
        <div className="space-y-4">
          <div
            className="rounded-xl p-4 border"
            style={{ backgroundColor: '#E8F5E8', borderColor: '#C8E6C9' }}
          >
            <p className="text-sm text-[#3D6B3D] font-semibold">
              This is the main system prompt that controls HiAlice's behavior. It defines the teaching style and tone for all interactions.
            </p>
          </div>

          <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-6 border border-[#E8DEC8]">
            <label className="block text-sm font-bold text-[#6B5744] mb-3">
              Main System Prompt
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full px-4 py-3 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8] text-[#3D2E1E] font-mono text-sm"
              rows="15"
            />
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleSavePrompt}
              className="px-6 py-3 bg-[#5C8B5C] text-white rounded-xl hover:bg-[#3D6B3D] transition-all font-bold shadow-[0_2px_8px_rgba(61,107,61,0.3)] hover:-translate-y-0.5"
              style={{ minHeight: '48px' }}
            >
              Save Prompt
            </button>
            <button
              onClick={() => {
                setTestResponse('');
                setShowTestModal(true);
              }}
              className="px-6 py-3 bg-[#87CEDB] text-[#3D2E1E] rounded-xl hover:bg-[#5BA8B8] hover:text-white transition-all font-bold shadow-[0_2px_8px_rgba(135,206,219,0.3)] hover:-translate-y-0.5"
              style={{ minHeight: '48px' }}
            >
              Test Prompt
            </button>
            {saveStatus && (
              <div
                className="px-6 py-3 rounded-xl font-bold flex items-center"
                style={{
                  minHeight: '48px',
                  backgroundColor: saveStatus.includes('success') ? '#C8E6C9' : '#FFF8E1',
                  color: saveStatus.includes('success') ? '#2E7D32' : '#8C6D00',
                }}
              >
                {saveStatus}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Level-Specific Tab */}
      {activeTab === 'levels' && (
        <div className="space-y-4">
          <div
            className="rounded-xl p-4 border"
            style={{ backgroundColor: '#E8F5E8', borderColor: '#C8E6C9' }}
          >
            <p className="text-sm text-[#3D6B3D] font-semibold">
              Override the main system prompt with level-specific instructions. These are applied when the student's level is detected.
            </p>
          </div>

          {/* Level Tabs */}
          <div
            className="flex gap-2"
            style={{ borderBottom: '2px solid #E8DEC8' }}
          >
            {['Beginner', 'Intermediate', 'Advanced'].map((level) => {
              const style = LEVEL_TAB_STYLES[level];
              const isActive = activeLevelTab === level;
              return (
                <button
                  key={level}
                  onClick={() => setActiveLevelTab(level)}
                  className="px-6 py-3 font-bold transition-all border-b-4"
                  style={{
                    minHeight: '48px',
                    color: isActive ? style.active.bg : '#6B5744',
                    borderBottomColor: isActive ? style.active.bg : 'transparent',
                  }}
                >
                  {level}
                </button>
              );
            })}
          </div>

          <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-6 border border-[#E8DEC8]">
            <label className="block text-sm font-bold text-[#6B5744] mb-3">
              {activeLevelTab} Level Instructions
            </label>
            <textarea
              value={levelPrompts[activeLevelTab]}
              onChange={(e) =>
                setLevelPrompts({
                  ...levelPrompts,
                  [activeLevelTab]: e.target.value,
                })
              }
              className="w-full px-4 py-3 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8] text-[#3D2E1E] font-mono text-sm"
              rows="10"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSavePrompt}
              className="px-6 py-3 bg-[#5C8B5C] text-white rounded-xl hover:bg-[#3D6B3D] transition-all font-bold shadow-[0_2px_8px_rgba(61,107,61,0.3)] hover:-translate-y-0.5"
              style={{ minHeight: '48px' }}
            >
              Save Level Prompts
            </button>
          </div>
        </div>
      )}

      {/* Stage Templates Tab */}
      {activeTab === 'stages' && (
        <div className="space-y-4">
          <div
            className="rounded-xl p-4 border"
            style={{ backgroundColor: '#E8F5E8', borderColor: '#C8E6C9' }}
          >
            <p className="text-sm text-[#3D6B3D] font-semibold">
              Define specific prompt templates for each stage of the Q&A session. These guide the AI's behavior during each phase.
            </p>
          </div>

          {/* Stage Tabs */}
          <div
            className="flex gap-2 flex-wrap"
            style={{ borderBottom: '2px solid #E8DEC8' }}
          >
            {Object.keys(stageTemplates).map((stage) => {
              const isActive = activeStageTab === stage;
              const borderColor = stageBorderColors[stage] || '#5C8B5C';
              return (
                <button
                  key={stage}
                  onClick={() => setActiveStageTab(stage)}
                  className="px-6 py-3 font-bold transition-all border-b-4"
                  style={{
                    minHeight: '48px',
                    color: isActive ? borderColor : '#6B5744',
                    borderBottomColor: isActive ? borderColor : 'transparent',
                  }}
                >
                  {stage}
                </button>
              );
            })}
          </div>

          <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] p-6 border border-[#E8DEC8]">
            <label className="block text-sm font-bold text-[#6B5744] mb-3">
              {activeStageTab} Stage Template
            </label>
            <textarea
              value={stageTemplates[activeStageTab]}
              onChange={(e) =>
                setStageTemplates({
                  ...stageTemplates,
                  [activeStageTab]: e.target.value,
                })
              }
              className="w-full px-4 py-3 border border-[#D6C9A8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5C8B5C] bg-[#F5F0E8] text-[#3D2E1E] font-mono text-sm"
              rows="12"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSavePrompt}
              className="px-6 py-3 bg-[#5C8B5C] text-white rounded-xl hover:bg-[#3D6B3D] transition-all font-bold shadow-[0_2px_8px_rgba(61,107,61,0.3)] hover:-translate-y-0.5"
              style={{ minHeight: '48px' }}
            >
              Save Stage Templates
            </button>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_4px_20px_rgba(61,46,30,0.08)] overflow-hidden border border-[#E8DEC8]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-[#E8DEC8] bg-[#F5F0E8]">
                    <th className="text-left py-4 px-4 font-bold text-[#6B5744]">Version</th>
                    <th className="text-left py-4 px-4 font-bold text-[#6B5744]">Date</th>
                    <th className="text-left py-4 px-4 font-bold text-[#6B5744]">Changes</th>
                    <th className="text-left py-4 px-4 font-bold text-[#6B5744]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_HISTORY.map((entry, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-[#EDE5D4] hover:bg-[#F5F0E8] transition-colors"
                    >
                      <td className="py-4 px-4 font-extrabold text-[#3D6B3D]">v{entry.version}</td>
                      <td className="py-4 px-4 text-[#6B5744] font-semibold">
                        {new Date(entry.date).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4 text-[#6B5744]">{entry.changes}</td>
                      <td className="py-4 px-4">
                        <button
                          className="px-3 py-2 rounded-lg text-xs font-bold transition-all"
                          style={{
                            backgroundColor: '#E0F4F9',
                            color: '#2A7A8C',
                            minHeight: '36px',
                          }}
                        >
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div
            className="rounded-xl p-4 border"
            style={{ backgroundColor: '#FFF8E1', borderColor: '#FFE0B2' }}
          >
            <p className="text-sm text-[#8C6D00] font-semibold">
              Currently using: <span className="font-extrabold">v{MOCK_HISTORY[0].version}</span>
            </p>
          </div>
        </div>
      )}

      {/* Test Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-[#3D2E1E] bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_8px_40px_rgba(61,46,30,0.25)] max-w-2xl w-full max-h-screen overflow-y-auto p-6 border border-[#E8DEC8]">
            <h2 className="text-2xl font-extrabold text-[#3D2E1E] mb-4">Test Prompt</h2>

            <div className="space-y-4">
              <div
                className="p-4 rounded-xl border"
                style={{ backgroundColor: '#F5F0E8', borderColor: '#D6C9A8' }}
              >
                <p className="text-sm font-bold text-[#6B5744] mb-2">Sample Input:</p>
                <p className="text-[#3D2E1E] font-semibold">
                  Student: "I liked the caterpillar because he was hungry like me sometimes."
                </p>
              </div>

              {testResponse && (
                <div
                  className="p-4 rounded-xl border"
                  style={{ backgroundColor: '#D6E9D6', borderColor: '#C8E6C9' }}
                >
                  <p className="text-sm font-bold text-[#6B5744] mb-2">HiAlice Response:</p>
                  <p className="text-[#3D2E1E] font-semibold">{testResponse}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleTestPrompt}
                  className="flex-1 px-4 py-3 bg-[#87CEDB] text-[#3D2E1E] rounded-xl hover:bg-[#5BA8B8] hover:text-white transition-all font-bold"
                  style={{ minHeight: '48px' }}
                >
                  Generate Response
                </button>
                <button
                  onClick={() => {
                    setShowTestModal(false);
                    setTestResponse('');
                  }}
                  className="flex-1 px-4 py-3 bg-[#EDE5D4] text-[#3D2E1E] rounded-xl hover:bg-[#D6C9A8] transition-all font-bold"
                  style={{ minHeight: '48px' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
