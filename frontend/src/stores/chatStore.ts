import { create } from 'zustand';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatContext {
  page: string;
  projectId?: number;
  projectName?: string;
  filters?: Record<string, string>;
}

export interface ChatStore {
  isOpen: boolean;
  messages: ChatMessage[];
  isLoading: boolean;
  currentContext: ChatContext;

  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  addMessage: (role: 'user' | 'assistant', content: string) => void;
  setLoading: (loading: boolean) => void;
  setContext: (ctx: ChatContext) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  isOpen: false,
  messages: [],
  isLoading: false,
  currentContext: { page: 'portfolio' },

  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),

  openChat: () => set({ isOpen: true }),

  closeChat: () => set({ isOpen: false }),

  addMessage: (role, content) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { role, content, timestamp: new Date() },
      ],
    })),

  setLoading: (loading) => set({ isLoading: loading }),

  setContext: (ctx) => set({ currentContext: ctx }),

  clearMessages: () => set({ messages: [] }),
}));
