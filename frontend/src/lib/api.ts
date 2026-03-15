const LOCAL_INIT_DATA_KEY = "telegram_init_data";
export const DICTIONARY_UPDATED_EVENT = "dictionary:updated";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
      };
    };
  }
}

function getTelegramInitData(): string {
  const fromWebApp = window.Telegram?.WebApp?.initData?.trim();
  if (fromWebApp) {
    localStorage.setItem(LOCAL_INIT_DATA_KEY, fromWebApp);
    return fromWebApp;
  }

  return localStorage.getItem(LOCAL_INIT_DATA_KEY)?.trim() || "";
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
