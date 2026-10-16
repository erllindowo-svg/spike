import "server-only";

import type { StatusTone } from "@/components/shared/status-badge";
import { dailyCallLimit } from "@/features/queries/budget";
import { getServerEnv, hasServerEnv } from "@/lib/env";
import { allowlistEnabled } from "@/lib/judit/guard";
import { callsPerMinuteLimit } from "@/lib/judit/rate-limit";

// Situação de cada integração, calculada no servidor a partir das variáveis
// de ambiente. Só sai daqui se cada variável está definida (e com formato
// válido), nunca o valor. "Definida" não quer dizer "funcionando": a chave da
// JUDIT e a conexão com o banco só são testadas quando usadas (ou com
// `pnpm env:check --db`).

export type EnvFacts = {
  dataSource: "demo" | "db";
  mongoUri: boolean;
  apiKey: boolean;
  liveCalls: boolean;
  webhookToken: boolean;
  publicOrigin: boolean;
  // Proteções de custo (círculo 2, S1 a S3).
  allowlist: boolean;
  callsPerMinute: number;
  dailyCallLimit: number;
};

export type IntegrationId = "judit" | "cost" | "webhooks" | "database";

export type IntegrationStatus = {
  id: IntegrationId;
  tone: StatusTone;
  label: string;
  description: string;
};

export function readEnvFacts(): EnvFacts {
  return {
    dataSource: getServerEnv("DATA_SOURCE"),
    mongoUri: hasServerEnv("MONGODB_URI"),
    apiKey: hasServerEnv("JUDIT_API_KEY"),
    // Mesma regra do guard.ts: só o valor exato "enabled" liga.
    liveCalls: getServerEnv("JUDIT_LIVE_CALLS") === "enabled",
    webhookToken: hasServerEnv("JUDIT_WEBHOOK_TOKEN"),
    publicOrigin: hasServerEnv("JUDIT_WEBHOOK_PUBLIC_ORIGIN"),
    allowlist: allowlistEnabled(),
    callsPerMinute: callsPerMinuteLimit(),
    dailyCallLimit: dailyCallLimit(),
  };
}

// Função pura, para os testes cobrirem cada combinação sem mexer no ambiente.
// `billedToday`: chamadas cobradas hoje, lidas do banco pela página (nulo se
// o banco não respondeu ou na demonstração).
export function describeIntegrations(
  facts: EnvFacts,
  billedToday: number | null = null,
): IntegrationStatus[] {
  return [
    judit(facts),
    cost(facts, billedToday),
    webhooks(facts),
    database(facts),
  ];
}

function cost(facts: EnvFacts, billedToday: number | null): IntegrationStatus {
  const id = "cost";
  if (facts.dataSource === "demo") {
    return {
      id,
      tone: "neutral",
      label: "Não usada",
      description: "DATA_SOURCE=demo: a demonstração não chama a JUDIT.",
    };
  }
  const limits =
    `Limites: ${facts.callsPerMinute} chamadas por minuto e ${facts.dailyCallLimit} cobradas por dia` +
    (billedToday === null ? "." : ` (hoje: ${billedToday}).`);
  return facts.allowlist
    ? {
        id,
        tone: "info",
        label: "Modo restrito",
        description: `Allowlist ligada: só os documentos de teste saem do servidor. ${limits}`,
      }
    : {
        id,
        tone: "warning",
        label: "Modo aberto",
        description: `Qualquer documento pode ser consultado (JUDIT_ALLOWLIST="disabled"). ${limits}`,
      };
}

function judit(facts: EnvFacts): IntegrationStatus {
  const id = "judit";
  if (facts.dataSource === "demo") {
    return {
      id,
      tone: "neutral",
      label: "Não usada",
      description: "DATA_SOURCE=demo: a demonstração não chama a JUDIT.",
    };
  }
  if (!facts.apiKey) {
    return {
      id,
      tone: "warning",
      label: "Não configurada",
      description:
        "JUDIT_API_KEY ausente: nenhuma consulta à JUDIT é possível.",
    };
  }
  if (!facts.liveCalls) {
    return {
      id,
      tone: "warning",
      label: "Chamadas bloqueadas",
      description:
        'Chave definida, mas JUDIT_LIVE_CALLS não é "enabled": o servidor barra toda chamada antes de enviá-la.',
    };
  }
  return {
    id,
    tone: "success",
    label: "Ligada",
    description:
      "Chave definida e chamadas reais ligadas. Buscas por documento ou CNJ só saem do servidor para os itens da lista de teste (allowlist).",
  };
}

// A rota só funciona no modo "db" e com o token; a origem pública decide se
// as consultas pedem entrega por webhook (src/features/webhooks/callback.ts).
function webhooks(facts: EnvFacts): IntegrationStatus {
  const id = "webhooks";
  if (facts.dataSource === "demo") {
    return {
      id,
      tone: "neutral",
      label: "Não usado",
      description: "Fora do modo db, a rota /api/webhooks/judit responde 404.",
    };
  }
  if (!facts.webhookToken && facts.publicOrigin) {
    return {
      id,
      tone: "warning",
      label: "Incompleto",
      description:
        "JUDIT_WEBHOOK_PUBLIC_ORIGIN definida sem JUDIT_WEBHOOK_TOKEN: a consulta assíncrona falha antes de chamar a JUDIT.",
    };
  }
  if (!facts.webhookToken) {
    return {
      id,
      tone: "neutral",
      label: "Desligado",
      description:
        "Sem JUDIT_WEBHOOK_TOKEN, a rota /api/webhooks/judit responde 404. As consultas assíncronas usam só polling.",
    };
  }
  if (!facts.publicOrigin) {
    return {
      id,
      tone: "info",
      label: "Só a rota",
      description:
        "A rota /api/webhooks/judit aceita entregas, mas sem JUDIT_WEBHOOK_PUBLIC_ORIGIN as consultas não pedem webhook: o resultado é buscado por polling.",
    };
  }
  return {
    id,
    tone: "success",
    label: "Ligado",
    description:
      "As consultas assíncronas pedem entrega por webhook no endereço público. O endereço não é testado aqui: se estiver fora do ar, as entregas não chegam.",
  };
}

function database(facts: EnvFacts): IntegrationStatus {
  const id = "database";
  if (facts.dataSource === "demo") {
    return {
      id,
      tone: "neutral",
      label: "Não usado",
      description:
        "DATA_SOURCE=demo: os dados são fictícios e ficam em memória.",
    };
  }
  if (!facts.mongoUri) {
    return {
      id,
      tone: "warning",
      label: "Incompleto",
      description: "DATA_SOURCE=db, mas MONGODB_URI está ausente ou inválida.",
    };
  }
  return {
    id,
    tone: "success",
    label: "Configurado",
    description:
      "Empresas, monitoramentos, consultas assíncronas, eventos de webhook e alertas ficam no MongoDB. A conexão não é testada aqui: use pnpm env:check --db.",
  };
}
