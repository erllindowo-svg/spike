// Cookie da vista de suporte: o navegador grava e lê (support-view.tsx).
// Não é segredo nem proteção: só a preferência de interface de quem usa
// este navegador.

export const SUPPORT_VIEW_COOKIE = "raio-x-vista-suporte";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function supportViewFromCookieHeader(header: string): boolean {
  return header
    .split(";")
    .some((part) => part.trim() === `${SUPPORT_VIEW_COOKIE}=on`);
}

// Texto para document.cookie. Desligar apaga o cookie (max-age=0).
export function supportViewCookieValue(enabled: boolean): string {
  const value = enabled ? "on" : "";
  const maxAge = enabled ? ONE_YEAR_SECONDS : 0;
  return `${SUPPORT_VIEW_COOKIE}=${value}; path=/; max-age=${maxAge}; samesite=lax`;
}
