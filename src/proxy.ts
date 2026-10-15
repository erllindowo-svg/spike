import { NextResponse, type NextRequest } from "next/server";

// Filtro que roda antes de qualquer rota (Proxy, o antigo middleware:
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
//
// Para receber webhooks em desenvolvimento, um túnel (cloudflared) torna o
// servidor de dev acessível pela internet. Sem este filtro, quem chegasse
// pelo túnel veria o app inteiro: páginas, server actions (que são POSTs para
// a própria página) e as rotas de dev, que fazem chamadas cobradas à JUDIT.
// Regra: em desenvolvimento, uma requisição que não veio desta máquina só
// alcança a rota do webhook; o resto responde 404.
//
// "Veio desta máquina": o cabeçalho Host é local E não há cabeçalhos que a
// Cloudflare acrescenta. Os dois sinais juntos: o Host sozinho falharia se o
// túnel fosse configurado para reescrevê-lo (--http-host-header).
//
// Só vale em desenvolvimento. Publicar o app exige autenticação de verdade,
// e mesmo assim cada server action continua conferindo o que pode fazer: a
// própria documentação do Next avisa para não depender só do Proxy.

const PUBLIC_PATHS = new Set(["/api/webhooks/judit"]);
const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "[::1]"]);
const CLOUDFLARE_HEADERS = ["cf-connecting-ip", "cf-ray"];

export function proxy(request: NextRequest) {
  if (
    process.env.NODE_ENV !== "development" ||
    PUBLIC_PATHS.has(request.nextUrl.pathname) ||
    isLocalRequest(request.headers)
  ) {
    return NextResponse.next();
  }
  return new NextResponse(null, { status: 404 });
}

export function isLocalRequest(headers: Headers): boolean {
  const hostname = (headers.get("host") ?? "").replace(/:\d+$/, "");
  return (
    LOCAL_HOSTNAMES.has(hostname) &&
    CLOUDFLARE_HEADERS.every((name) => !headers.has(name))
  );
}

export const config = {
  // Tudo, menos os arquivos estáticos do próprio Next.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
