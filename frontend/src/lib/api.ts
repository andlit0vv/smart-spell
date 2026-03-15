const LOCAL_INIT_DATA_KEY = "telegram_init_data";
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
          };
        };
        ready?: () => void;
      };
    };
  }
}

function getTelegramInitData(): string {
  const webApp = window.Telegram?.WebApp;
  const fromWebApp = webApp?.initData?.trim();

  if (webApp?.ready) {
    webApp.ready();
  }

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

  const webAppUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (webAppUser?.id && !headers.has("X-Telegram-Id")) {
    headers.set("X-Telegram-Id", String(webAppUser.id));
  }
  if (webAppUser?.username && !headers.has("X-Telegram-Username")) {
    headers.set("X-Telegram-Username", webAppUser.username);
  }
  if (webAppUser?.first_name && !headers.has("X-Telegram-First-Name")) {
    headers.set("X-Telegram-First-Name", webAppUser.first_name);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}

export const notifyDictionaryUpdated = () => {
  window.dispatchEvent(new CustomEvent(DICTIONARY_UPDATED_EVENT));
};
