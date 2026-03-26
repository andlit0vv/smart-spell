export const DICTIONARY_UPDATED_EVENT = "dictionary:updated";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: {
          user?: {
            id?: number;
            username?: string;
            first_name?: string;
            last_name?: string;
            language_code?: string;
            photo_url?: string;
          };
        };
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}

function getTelegramInitData(): string {
  const webApp = window.Telegram?.WebApp;
  webApp?.ready?.();
  webApp?.expand?.();

  const initData = webApp?.initData?.trim() || "";
  if (!initData) {
    console.error("[Auth] Telegram initData is empty. Open the app from Telegram Mini App.");
  }

  return initData;
}

function getTelegramUnsafeUserHeader(): string {
  const rawUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (!rawUser) return "";

  try {
    return JSON.stringify(rawUser);
  } catch {
    return "";
  }
}

async function waitForTelegramInitData(maxAttempts = 12, delayMs = 100): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const initData = getTelegramInitData();
    if (initData) return initData;

    await new Promise((resolve) => {
      window.setTimeout(resolve, delayMs);
    });
  }

  return "";
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  const initData = await waitForTelegramInitData();
  const unsafeUser = getTelegramUnsafeUserHeader();

  if (initData && !headers.has("X-Telegram-Init-Data")) {
    headers.set("X-Telegram-Init-Data", initData);
  }

  if (unsafeUser && !headers.has("X-Telegram-User")) {
    headers.set("X-Telegram-User", unsafeUser);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}

export const notifyDictionaryUpdated = () => {
  window.dispatchEvent(new CustomEvent(DICTIONARY_UPDATED_EVENT));
};
