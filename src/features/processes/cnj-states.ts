// Estados de um processo pelo número CNJ (círculo 5), para a busca achar
// "Roraima" nos processos do TJRR. A fonte é a numeração única do CNJ
// (Resolução CNJ nº 65/2008), não a JUDIT: no número
// NNNNNNN-DD.AAAA.J.TR.OOOO, J é o segmento da Justiça e TR, o tribunal.
// Escolha nossa: os tribunais superiores e os de abrangência nacional não
// têm estado; os regionais dão todos os estados que cobrem.

export type BrazilState = { uf: string; name: string };

// Na Justiça Estadual (8), na Eleitoral (6) e na Militar Estadual (9), TR é
// o código do estado, em ordem alfabética do nome.
const STATES: BrazilState[] = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SE", name: "Sergipe" },
  { uf: "SP", name: "São Paulo" },
  { uf: "TO", name: "Tocantins" },
];

const BY_UF = new Map(STATES.map((s) => [s.uf, s]));

// Justiça Federal (4): os seis TRFs (o TRF6, de Minas Gerais, existe desde
// 2022).
const FEDERAL: Record<number, string[]> = {
  1: ["AC", "AM", "AP", "BA", "DF", "GO", "MA", "MT", "PA", "PI", "RO", "RR", "TO"],
  2: ["RJ", "ES"],
  3: ["SP", "MS"],
  4: ["RS", "PR", "SC"],
  5: ["PE", "AL", "CE", "PB", "RN", "SE"],
  6: ["MG"],
}; // prettier-ignore

// Justiça do Trabalho (5): as 24 regiões dos TRTs.
const LABOR: Record<number, string[]> = {
  1: ["RJ"], 2: ["SP"], 3: ["MG"], 4: ["RS"], 5: ["BA"], 6: ["PE"],
  7: ["CE"], 8: ["PA", "AP"], 9: ["PR"], 10: ["DF", "TO"], 11: ["AM", "RR"],
  12: ["SC"], 13: ["PB"], 14: ["RO", "AC"], 15: ["SP"], 16: ["MA"],
  17: ["ES"], 18: ["GO"], 19: ["AL"], 20: ["SE"], 21: ["RN"], 22: ["PI"],
  23: ["MT"], 24: ["MS"],
}; // prettier-ignore

export function cnjStates(cnj: string): BrazilState[] {
  const digits = cnj.replace(/\D/g, "");
  if (digits.length !== 20) return [];
  const segment = Number(digits[13]);
  const tribunal = Number(digits.slice(14, 16));

  let ufs: string[] = [];
  if (segment === 8 || segment === 6 || segment === 9) {
    const state = STATES[tribunal - 1];
    ufs = state ? [state.uf] : [];
  } else if (segment === 4) {
    ufs = FEDERAL[tribunal] ?? [];
  } else if (segment === 5) {
    ufs = LABOR[tribunal] ?? [];
  }
  return ufs.map((uf) => BY_UF.get(uf)!).filter(Boolean);
}
