import { useState, useRef, useEffect, type FormEvent } from 'react';
import { MessageSquare, X, Trash2, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useChatStore } from '../../stores/chatStore';
import { postApi } from '../../api/client';

// Context-aware suggestion questions keyed by page name
const SUGGESTIONS: Record<string, string[]> = {
  portfolio: [
    'Which projects are most at risk right now?',
    'Give me a portfolio health summary.',
    'What are the top 3 schedule risks?',
    'How many projects are over budget?',
  ],
  overview: [
    'Which projects are most at risk right now?',
    'Give me a portfolio health summary.',
    'What are the top 3 schedule risks?',
    'How many projects are over budget?',
  ],
  cost: [
    'Which project has the highest cost overrun?',
    'What is the average CPI across all projects?',
    'Show me projects with CPI below 0.9.',
    'What is the total portfolio spend vs budget?',
  ],
  schedule: [
    'Which tasks are on the critical path?',
    'What projects have slipped more than 2 weeks?',
    'Show me SPI trends over the last quarter.',
    'Are there any milestone slippages this month?',
  ],
  'red-line': [
    'What are the most severe deviations?',
    'How many red-line breaches occurred this month?',
    'Which deviation categories appear most often?',
    'List all critical deviations sorted by severity.',
  ],
  project: [
    'Summarise the status of this project.',
    'What are the key risks for this project?',
    'Show me the cost breakdown for this project.',
    'Are there any overdue milestones?',
  ],
};

function getSuggestions(page: string, projectName?: string): string[] {
  if (page === 'project' && projectName) {
    return SUGGESTIONS.project.map((q) =>
      q.replace('this project', projectName),
    );
  }
  return SUGGESTIONS[page] ?? SUGGESTIONS.overview;
}

function ContextBadge({ page, projectName }: { page: string; projectName?: string }) {
  const label =
    page === 'project' && projectName
      ? `Project: ${projectName}`
      : page
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');

  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
      {label}
    </span>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-2">
      <div className="flex gap-1">
        <span className="typing-dot h-2 w-2 rounded-full bg-slate-400" />
        <span className="typing-dot h-2 w-2 rounded-full bg-slate-400" />
        <span className="typing-dot h-2 w-2 rounded-full bg-slate-400" />
      </div>
    </div>
  );
}

export default function ChatPanel() {
  const {
    isOpen,
    messages,
    isLoading,
    currentContext,
    toggleChat,
    addMessage,
    setLoading,
    clearMessages,
  } = useChatStore();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setInput('');
    addMessage('user', trimmed);
    setLoading(true);

    try {
      const data = await postApi<{ answer: string }>('/api/nl-query', {
        question: trimmed,
      });
      addMessage('assistant', data.answer);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      addMessage('assistant', `Sorry, I encountered an error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    handleSend(input);
  }

  function handleSuggestionClick(suggestion: string) {
    handleSend(suggestion);
  }

  const suggestions = getSuggestions(
    currentContext.page,
    currentContext.projectName,
  );

  return (
    <>
      {/* Floating toggle button (visible when panel is closed) */}
      {!isOpen && (
        <button
          onClick={toggleChat}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105 hover:bg-primary-dark"
          aria-label="Open AI Assistant"
        >
          <MessageSquare size={24} />
        </button>
      )}

      {/* Slide-out panel */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-screen w-96 flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-primary" />
            <h2 className="text-sm font-semibold text-slate-900">AI Assistant</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={clearMessages}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Clear chat history"
              title="Clear history"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={toggleChat}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close chat panel"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Context badge */}
        <div className="border-b border-slate-100 px-4 py-2">
          <ContextBadge
            page={currentContext.page}
            projectName={currentContext.projectName}
          />
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 && !isLoading ? (
            <div className="flex flex-col gap-4">
              <p className="text-center text-sm text-muted">
                Ask a question about your portfolio data. Here are some suggestions:
              </p>
              <div className="flex flex-col gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((msg, idx) => (
                <div
                  key={`${msg.role}-${idx}-${msg.timestamp.getTime()}`}
                  className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-primary text-white rounded-br-md'
                        : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm prose-slate max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}

              {isLoading && <TypingIndicator />}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-slate-200 px-4 py-3">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your portfolio..."
              disabled={isLoading}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-white transition-colors hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
