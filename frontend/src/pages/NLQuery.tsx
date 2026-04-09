import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { Send, Trash2, Sparkles, ChevronRight } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import { useChatStore } from '../stores/chatStore';
import type { ChatMessage } from '../stores/chatStore';
import { ApiError, postApi } from '../api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NLQueryResponse {
  answer: string;
}

interface ExampleQuestion {
  category: string;
  text: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXAMPLE_QUESTIONS: ExampleQuestion[] = [
  { category: 'Portfolio', text: 'Which projects have the worst CPI?' },
  { category: 'Portfolio', text: 'What is the total cost overrun across all projects?' },
  { category: 'Schedule', text: 'Show me all critical milestones that have slipped more than 10 days' },
  { category: 'Schedule', text: 'Which projects are behind schedule?' },
  { category: 'Cost', text: 'Compare budget vs actual cost for the top 5 most expensive projects' },
  { category: 'Cost', text: 'What is the average CPI across all active projects?' },
  { category: 'Deviations', text: 'List all critical deviations in the Westminster project' },
  { category: 'Deviations', text: 'Which project phase has the most cost overruns?' },
];

const CATEGORY_COLORS: Record<string, string> = {
  Portfolio: 'text-blue-600 bg-blue-50',
  Schedule: 'text-amber-600 bg-amber-50',
  Cost: 'text-emerald-600 bg-emerald-50',
  Deviations: 'text-rose-600 bg-rose-50',
};

// ---------------------------------------------------------------------------
// Markdown components for styled tables, code, etc.
// ---------------------------------------------------------------------------

const markdownComponents: Components = {
  table: ({ children, ...props }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-slate-100" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }) => (
    <th className="border-b-2 border-slate-200 px-3 py-2 text-left font-semibold text-slate-700" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border-b border-slate-100 px-3 py-2 text-slate-700" {...props}>
      {children}
    </td>
  ),
  tr: ({ children, ...props }) => (
    <tr className="even:bg-slate-50" {...props}>
      {children}
    </tr>
  ),
  code: ({ children, className, ...props }) => {
    const isBlock = className?.startsWith('language-');
    if (isBlock) {
      return (
        <pre className="my-2 overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      );
    }
    return (
      <code
        className="rounded bg-slate-100 px-1.5 py-0.5 text-sm font-mono text-rose-600"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => <>{children}</>,
  ul: ({ children, ...props }) => (
    <ul className="my-2 ml-4 list-disc space-y-1 text-slate-700" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="my-2 ml-4 list-decimal space-y-1 text-slate-700" {...props}>
      {children}
    </ol>
  ),
  a: ({ children, href, ...props }) => (
    <a
      href={href}
      className="text-blue-600 underline hover:text-blue-800"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  p: ({ children, ...props }) => (
    <p className="my-1.5 leading-relaxed" {...props}>
      {children}
    </p>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-slate-900" {...props}>
      {children}
    </strong>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="my-2 border-l-4 border-blue-300 bg-blue-50/50 py-1 pl-4 italic text-slate-600"
      {...props}
    >
      {children}
    </blockquote>
  ),
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function formatTimestamp(date: Date): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 animate-fade-in">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 shadow-sm">
        <Sparkles className="h-4 w-4 text-white" />
      </div>
      <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-5 py-3.5 shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="typing-dot inline-block h-2 w-2 rounded-full bg-slate-400" />
          <span className="typing-dot inline-block h-2 w-2 rounded-full bg-slate-400" />
          <span className="typing-dot inline-block h-2 w-2 rounded-full bg-slate-400" />
        </div>
      </div>
    </div>
  );
}

function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex justify-end animate-fade-in">
      <div className="max-w-[75%]">
        <div className="rounded-2xl rounded-br-md bg-blue-600 px-5 py-3 text-white shadow-sm">
          <p className="leading-relaxed">{message.content}</p>
        </div>
        <p className="mt-1 text-right text-xs text-slate-400">
          {formatTimestamp(message.timestamp)}
        </p>
      </div>
    </div>
  );
}

function AssistantMessage({ message }: { message: ChatMessage }) {
  const isError =
    message.content.startsWith('Error:') ||
    message.content.startsWith('Sorry,') ||
    message.content.startsWith('I encountered');

  return (
    <div className="flex items-start gap-3 animate-fade-in">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 shadow-sm">
        <Sparkles className="h-4 w-4 text-white" />
      </div>
      <div className="max-w-[85%]">
        <div
          className={`rounded-2xl rounded-tl-md border px-5 py-3.5 shadow-sm ${
            isError
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-slate-200 bg-white text-slate-800'
          }`}
        >
          <div className="prose prose-sm prose-slate max-w-none">
            <ReactMarkdown components={markdownComponents}>
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          {formatTimestamp(message.timestamp)}
        </p>
      </div>
    </div>
  );
}

function ExampleCard({
  question,
  onClick,
}: {
  question: ExampleQuestion;
  onClick: (text: string) => void;
}) {
  const colorClass = CATEGORY_COLORS[question.category] ?? 'text-slate-600 bg-slate-50';

  return (
    <button
      type="button"
      onClick={() => onClick(question.text)}
      className="group flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
    >
      <span
        className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
      >
        {question.category}
      </span>
      <span className="text-sm leading-snug text-slate-700 group-hover:text-slate-900">
        {question.text}
      </span>
      <ChevronRight className="mt-auto h-4 w-4 self-end text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-blue-500" />
    </button>
  );
}

function WelcomeState({ onExampleClick }: { onExampleClick: (text: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 shadow-lg">
        <Sparkles className="h-8 w-8 text-white" />
      </div>
      <h2 className="mb-2 text-xl font-semibold text-slate-900">
        Ask me anything about your portfolio
      </h2>
      <p className="mb-8 max-w-md text-center text-sm text-slate-500">
        I can query the project database, analyze trends, and provide insights
      </p>
      <div className="grid w-full max-w-[700px] grid-cols-1 gap-3 sm:grid-cols-2">
        {EXAMPLE_QUESTIONS.map((q) => (
          <ExampleCard key={q.text} question={q} onClick={onExampleClick} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

function NLQuery() {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const addMessage = useChatStore((s) => s.addMessage);
  const setLoading = useChatStore((s) => s.setLoading);
  const setContext = useChatStore((s) => s.setContext);
  const clearMessages = useChatStore((s) => s.clearMessages);

  // Set context on mount
  useEffect(() => {
    setContext({ page: 'nl-query' });
  }, [setContext]);

  // Auto-scroll to bottom when new messages arrive or loading changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendQuestion = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || isLoading) return;

      addMessage('user', trimmed);
      setInputValue('');
      setLoading(true);

      // Re-focus input after clearing
      setTimeout(() => inputRef.current?.focus(), 0);

      try {
        const response = await postApi<NLQueryResponse>('/api/nl-query', {
          question: trimmed,
        });
        addMessage('assistant', response.answer);
      } catch (err) {
        let message = 'An unexpected error occurred';
        if (err instanceof ApiError) {
          try {
            const parsed = JSON.parse(err.body) as { detail?: string };
            message = parsed.detail || err.message;
          } catch {
            message = err.body || err.message;
          }
        } else if (err instanceof Error) {
          message = err.message;
        }
        addMessage(
          'assistant',
          `Error: Unable to process your query. ${message}`
        );
      } finally {
        setLoading(false);
        // Re-focus input after response
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    },
    [isLoading, addMessage, setLoading]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuestion(inputValue);
    }
  };

  const handleClearHistory = () => {
    clearMessages();
    setInputValue('');
    inputRef.current?.focus();
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <PageHeader
        title="AI Assistant"
        subtitle="Ask questions about your project portfolio in natural language"
        actions={
          hasMessages ? (
            <button
              type="button"
              onClick={handleClearHistory}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
              Clear history
            </button>
          ) : undefined
        }
      />

      {/* Main chat area */}
      <div className="mx-auto flex w-full max-w-[900px] flex-1 flex-col overflow-hidden">
        {!hasMessages ? (
          <WelcomeState onExampleClick={sendQuestion} />
        ) : (
          /* Messages list */
          <div
            ref={messagesContainerRef}
            className="flex-1 space-y-5 overflow-y-auto px-1 py-4"
            style={{ maxHeight: 'calc(100vh - 300px)' }}
          >
            {messages.map((msg, idx) =>
              msg.role === 'user' ? (
                <UserMessage key={idx} message={msg} />
              ) : (
                <AssistantMessage key={idx} message={msg} />
              )
            )}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input area */}
        <div className="shrink-0 border-t border-slate-200 bg-white pt-4">
          <div className="flex items-end gap-3">
            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your projects..."
                rows={1}
                className="w-full resize-none rounded-2xl border border-slate-300 bg-slate-50 px-5 py-3.5 pr-4 text-sm text-slate-800 shadow-sm transition-all duration-200 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-100"
                style={{
                  minHeight: '48px',
                  maxHeight: '120px',
                  height: 'auto',
                  overflow: inputValue.includes('\n') ? 'auto' : 'hidden',
                }}
                onInput={(e) => {
                  const target = e.currentTarget;
                  target.style.height = 'auto';
                  target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => sendQuestion(inputValue)}
              disabled={!inputValue.trim() || isLoading}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-slate-400">
            Responses are generated by AI and may contain inaccuracies. Verify important data.
          </p>
        </div>
      </div>

      {/* Inline styles for fade-in animation */}
      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

export default NLQuery;
