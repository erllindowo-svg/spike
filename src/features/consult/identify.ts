import type { SearchType } from "@/lib/models";
import { formatCnpj, isValidCnpj } from "@/features/parties/cnpj";
import { formatCpf, isValidCpf, maskCpf } from "@/features/parties/cpf";
import { formatCnj, isValidCnj } from "@/features/processes/cnj";

// Reconhece o identificador pelo que foi digitado, sem a pessoa escolher o
// tipo (círculo 3, fatia 1, em docs/etapa-7-escopo.md). Função pura: não
// consulta a JUDIT nem o banco.
//
// Como cada tipo se separa:
//   CPF   11 dígitos com os dois verificadores (módulo 11)
//   CNPJ  14 caracteres, numérico ou alfanumérico, com verificadores
//   CNJ   20 dígitos com o verificador do CNJ (módulo 97)
//   RJI   20 caracteres que não formam um CNJ válido. A documentação só tem
//         um exemplo, 20 zeros (README da integração, item 47); se o RJI
//         tiver letras, ele se separa sozinho do CNJ (pergunta IK15)
//   OAB   número e UF, nas duas ordens ("123456SP" ou "SP123456"). A
//         documentação usa as duas (README, item 47); gravamos número + UF,
//         a forma da maioria dos exemplos. Hipótese a testar ao vivo
//   Nome  o que sobra, com tamanho mínimo; traz homônimos
//
// A digitação pela metade não salta de tipo por acaso: com máscara ("/" de
// CNPJ, "-DD." de CNJ, "NNN.NNN" de CPF), o tipo segue a máscara.

export type { SearchType };

export type Candidate = { type: SearchType; key: string };

export type Identification =
  | { status: "empty" }
  // Ainda faltam caracteres; `expected` diz o que pode estar sendo digitado.
  | { status: "incomplete"; expected: SearchType[]; message: string }
  // O tamanho fecha, mas os verificadores não batem.
  | { status: "invalid"; expected: SearchType; message: string }
  // O primeiro candidato é o reconhecido; os outros aparecem em "não é
  // isso?". `note` explica uma escolha que pode estar errada.
  | {
      status: "recognized";
      candidates: [Candidate, ...Candidate[]];
      note: string | null;
    };

export const SEARCH_TYPES: Record<
  SearchType,
  { label: string; description: string }
> = {
  cpf: { label: "CPF", description: "Pessoa física" },
  cnpj: { label: "CNPJ", description: "Empresa" },
  cnj: { label: "Processo (CNJ)", description: "Número único do processo" },
  oab: { label: "OAB", description: "Advogado, pelo número e UF" },
  name: { label: "Nome", description: "Pessoa ou empresa pelo nome" },
  rji: { label: "RJI", description: "Registro no BNMP, só para mandados" },
};

export const NAME_MIN_LENGTH = 5;

const UFS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
]); // prettier-ignore

const CPF_LENGTH = 11;
const CNPJ_LENGTH = 14;
const CNJ_LENGTH = 20;

function recognized(
  candidates: [Candidate, ...Candidate[]],
  note: string | null = null,
): Identification {
  return { status: "recognized", candidates, note };
}

export function identify(raw: string): Identification {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value === "") return { status: "empty" };

  const upper = value.toUpperCase();
  const compact = upper.replace(/[^0-9A-Z]/g, "");
  const onlyDigitsAndMask = /^[\d.\-/\s]+$/.test(value);

  // OAB antes do nome: "OAB/SP 123.456", "123456-SP", "SP 123456".
  const oab = oabKey(compact);
  if (oab) return recognized([{ type: "oab", key: oab }]);

  if (onlyDigitsAndMask) return fromDigits(value, compact);

  // Com letras e sem espaço: CNPJ alfanumérico ou RJI com letras.
  if (!value.includes(" ") && /\d/.test(compact)) {
    return fromAlphanumeric(compact);
  }

  if (/[A-Za-zÀ-ÿ]/.test(value) && value.length >= NAME_MIN_LENGTH) {
    return recognized(
      [{ type: "name", key: value }],
      "Busca por nome traz homônimos: pessoas ou empresas com nome igual ou parecido.",
    );
  }
  return {
    status: "incomplete",
    expected: ["name"],
    message: `Para buscar por nome, digite pelo menos ${NAME_MIN_LENGTH} caracteres.`,
  };
}

function oabKey(compact: string): string | null {
  const withoutPrefix = compact.startsWith("OAB") ? compact.slice(3) : compact;
  const match =
    /^(\d{1,6})([A-Z]{2})$/.exec(withoutPrefix) ??
    /^([A-Z]{2})(\d{1,6})$/.exec(withoutPrefix);
  if (!match) return null;
  const [number, uf] = /^\d/.test(match[1])
    ? [match[1], match[2]]
    : [match[2], match[1]];
  if (!UFS.has(uf)) return null;
  return `${number}${uf}`;
}

function fromDigits(value: string, digits: string): Identification {
  // Máscara explícita: o tipo segue a máscara, mesmo pela metade.
  if (value.includes("/") || /^\d{2}\.\d{3}\./.test(value)) {
    return byLength(digits, "cnpj");
  }
  if (/^\d{7}-\d{2}/.test(value) || /\.\d{4}\.\d\./.test(value)) {
    return byLength(digits, "cnj");
  }
  if (/^\d{3}\.\d{3}/.test(value)) return byLength(digits, "cpf");

  // Só dígitos: pelo tamanho.
  if (digits.length === CPF_LENGTH && isValidCpf(digits)) {
    return recognized([{ type: "cpf", key: digits }]);
  }
  if (digits.length === CNPJ_LENGTH && isValidCnpj(digits)) {
    return recognized([{ type: "cnpj", key: digits }]);
  }
  if (digits.length === CNJ_LENGTH) {
    if (isValidCnj(digits)) {
      return recognized([
        { type: "cnj", key: digits },
        { type: "rji", key: digits },
      ]);
    }
    return recognized(
      [{ type: "rji", key: digits }],
      "Não é um número de processo válido (os dígitos verificadores do CNJ não batem). Se era um processo, confira o número.",
    );
  }
  if (digits.length > CNJ_LENGTH) {
    return {
      status: "invalid",
      expected: "cnj",
      message: "Número longo demais: um processo (CNJ) tem 20 dígitos.",
    };
  }
  return {
    status: "incomplete",
    expected: expectedByLength(digits.length),
    message:
      digits.length === CPF_LENGTH
        ? "Não forma um CPF válido. Se for um CNPJ ou um processo, continue digitando."
        : digits.length === CNPJ_LENGTH
          ? "Não forma um CNPJ válido. Se for um processo, continue digitando."
          : "Continue digitando: CPF tem 11 dígitos, CNPJ 14 e processo (CNJ) 20.",
  };
}

function expectedByLength(length: number): SearchType[] {
  if (length < CPF_LENGTH) return ["cpf", "cnpj", "cnj"];
  if (length < CNPJ_LENGTH) return ["cnpj", "cnj"];
  return ["cnj"];
}

const EXPECTED_LENGTH: Record<"cpf" | "cnpj" | "cnj", number> = {
  cpf: CPF_LENGTH,
  cnpj: CNPJ_LENGTH,
  cnj: CNJ_LENGTH,
};

const VALIDATORS: Record<"cpf" | "cnpj" | "cnj", (key: string) => boolean> = {
  cpf: isValidCpf,
  cnpj: isValidCnpj,
  cnj: isValidCnj,
};

function byLength(key: string, type: "cpf" | "cnpj" | "cnj"): Identification {
  const label = SEARCH_TYPES[type].label;
  const expected = EXPECTED_LENGTH[type];
  if (key.length < expected) {
    return {
      status: "incomplete",
      expected: [type],
      message: `Continue digitando: ${label} tem ${expected} ${type === "cnpj" ? "caracteres" : "dígitos"}.`,
    };
  }
  if (key.length > expected || !VALIDATORS[type](key)) {
    return {
      status: "invalid",
      expected: type,
      message: `${label} inválido: confira o número (os dígitos verificadores não batem).`,
    };
  }
  return recognized([{ type, key }]);
}

function fromAlphanumeric(compact: string): Identification {
  if (compact.length < CNPJ_LENGTH) {
    return {
      status: "incomplete",
      expected: ["cnpj", "rji"],
      message:
        "Continue digitando: o CNPJ alfanumérico tem 14 caracteres. Para buscar por nome, use letras e espaços.",
    };
  }
  if (compact.length === CNPJ_LENGTH) {
    return isValidCnpj(compact)
      ? recognized([{ type: "cnpj", key: compact }])
      : {
          status: "invalid",
          expected: "cnpj",
          message:
            "CNPJ inválido: confira o número (os dígitos verificadores não batem).",
        };
  }
  if (compact.length === CNJ_LENGTH) {
    return recognized([{ type: "rji", key: compact }]);
  }
  return {
    status: "incomplete",
    expected: ["rji"],
    message: "Não reconhecido: um RJI tem 20 caracteres.",
  };
}

// Valida no servidor: o identificador precisa ser reconhecido com o tipo
// pedido (como primeiro candidato ou alternativa). Devolve a chave
// normalizada, ou null.
export function parseSearchKey(type: SearchType, raw: string): string | null {
  const result = identify(raw);
  if (result.status !== "recognized") return null;
  return result.candidates.find((c) => c.type === type)?.key ?? null;
}

// Como a chave aparece por extenso (página do assunto, resultado).
export function formatSearchKey(type: SearchType, key: string): string {
  switch (type) {
    case "cpf":
      return formatCpf(key);
    case "cnpj":
      return formatCnpj(key);
    case "cnj":
      return formatCnj(key);
    case "oab": {
      const match = /^(\d+)([A-Z]{2})$/.exec(key);
      return match ? `OAB ${match[1]}/${match[2]}` : key;
    }
    default:
      return key;
  }
}

// O campo de Consultar (círculo 3B) mostra CPF, CNPJ e CNJ reconhecidos com
// os separadores como caracteres de verdade na caixa de texto. O estado do
// campo guarda só o que foi digitado, sem os separadores que o app inseriu:
// o reconhecimento segue a máscara digitada pela pessoa ("529.982.…" é CPF),
// e um dígito a mais depois de um CPF formatado viraria "CPF inválido" para
// quem está digitando um CNPJ.
const FIELD_MASKED: ReadonlySet<SearchType> = new Set(["cpf", "cnpj", "cnj"]);

// O que a caixa mostra no lugar do valor guardado, ou null se mostra o valor
// como está. Só formata o que foi digitado sem máscara (valor igual à
// chave): uma máscara digitada pela pessoa fica como ela escreveu.
export function fieldDisplay(
  value: string,
  target: Candidate | null,
): string | null {
  if (!target || !FIELD_MASKED.has(target.type) || value !== target.key) {
    return null;
  }
  return formatSearchKey(target.type, target.key);
}

// O valor a guardar depois de uma tecla numa caixa formatada: tira os
// separadores que o app inseriu.
export function stripFieldMask(typed: string): string {
  return typed.replace(/[.\-/]/g, "");
}

// Como a chave aparece em listas: o CPF mascarado (dado pessoal).
export function displaySearchKey(type: SearchType, key: string): string {
  return type === "cpf" ? maskCpf(key) : formatSearchKey(type, key);
}
