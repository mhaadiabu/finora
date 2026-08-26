import type { RemoteThreadListAdapter, ThreadMessage } from '@assistant-ui/react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAssistantStream, type AssistantStream } from 'assistant-stream';
import * as Crypto from 'expo-crypto';

import { fallbackThreadTitle } from './remote-thread-adapter';
import { userStorageKey } from './session-storage';

const LOCAL_THREADS_KEY = 'finora:local-threads:v1';
const localThreadsKey = () => userStorageKey(LOCAL_THREADS_KEY);

export type LocalThreadItem = {
  remoteId: string;
  title?: string;
  status: 'regular' | 'archived';
  lastMessageAt: Date;
};

type StoredLocalThread = {
  id: string;
  title: string | null;
  status: 'regular' | 'archived';
  lastMessageAt: string;
};

function toLocalItem(stored: StoredLocalThread): LocalThreadItem {
  return {
    remoteId: stored.id,
    title: stored.title ?? undefined,
    status: stored.status,
    lastMessageAt: new Date(stored.lastMessageAt),
  };
}

async function readStoredThreads(): Promise<StoredLocalThread[]> {
  try {
    const raw = await AsyncStorage.getItem(localThreadsKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeStoredThreads(threads: StoredLocalThread[]) {
  try {
    await AsyncStorage.setItem(localThreadsKey(), JSON.stringify(threads));
  } catch {
    // Ignore storage errors
  }
}

export function createTitleTokenStream(title: string): AssistantStream {
  return createAssistantStream(async (controller) => {
    const tokens = title.split(/(\s+)/);
    for (const token of tokens) {
      if (!token) continue;
      controller.appendText(token);
      await new Promise((resolve) => setTimeout(resolve, 35));
    }
  }) as AssistantStream;
}

export function createLocalThreadListAdapter(): RemoteThreadListAdapter {
  let inMemoryThreads: StoredLocalThread[] | null = null;

  async function getThreads() {
    if (inMemoryThreads !== null) return inMemoryThreads;
    inMemoryThreads = await readStoredThreads();
    return inMemoryThreads;
  }

  async function persist() {
    if (inMemoryThreads) {
      await writeStoredThreads(inMemoryThreads);
    }
  }

  return {
    async list() {
      const threads = await getThreads();
      return {
        threads: threads.map(toLocalItem),
      };
    },

    async initialize() {
      const threads = await getThreads();
      const remoteId = `local_thread_${Crypto.randomUUID().replaceAll('-', '')}`;
      const newEntry: StoredLocalThread = {
        id: remoteId,
        title: 'New chat',
        status: 'regular',
        lastMessageAt: new Date().toISOString(),
      };
      threads.unshift(newEntry);
      void persist();
      return { remoteId };
    },

    async fetch(remoteId) {
      const threads = await getThreads();
      const match = threads.find((t) => t.id === remoteId);
      if (!match) {
        return {
          remoteId,
          status: 'regular',
          title: 'New chat',
          lastMessageAt: new Date(),
        };
      }
      return toLocalItem(match);
    },

    async rename(remoteId, newTitle) {
      const threads = await getThreads();
      const match = threads.find((t) => t.id === remoteId);
      if (match) {
        match.title = newTitle;
        match.lastMessageAt = new Date().toISOString();
        void persist();
      }
    },

    async archive(remoteId) {
      const threads = await getThreads();
      const match = threads.find((t) => t.id === remoteId);
      if (match) {
        match.status = 'archived';
        void persist();
      }
    },

    async unarchive(remoteId) {
      const threads = await getThreads();
      const match = threads.find((t) => t.id === remoteId);
      if (match) {
        match.status = 'regular';
        void persist();
      }
    },

    async delete(remoteId) {
      const threads = await getThreads();
      inMemoryThreads = threads.filter((t) => t.id !== remoteId);
      void persist();
    },

    async generateTitle(remoteId, messages: readonly ThreadMessage[]) {
      const title = fallbackThreadTitle(messages);
      const threads = await getThreads();
      const match = threads.find((t) => t.id === remoteId);
      if (match) {
        match.title = title;
        match.lastMessageAt = new Date().toISOString();
        void persist();
      }
      return createTitleTokenStream(title);
    },
  };
}
