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

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  const initData = getTelegramInitData();

  if (initData && !headers.has("X-Telegram-Init-Data")) {
    headers.set("X-Telegram-Init-Data", initData);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}

export const notifyDictionaryUpdated = () => {
  window.dispatchEvent(new CustomEvent(DICTIONARY_UPDATED_EVENT));
};
