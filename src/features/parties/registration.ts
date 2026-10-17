// Dados cadastrais de uma parte, como a tela os mostra. No app real vêm de
// POST /entities da JUDIT; no protótipo, dos dados fictícios.

export type RegistrationData = {
  // A JUDIT devolveu um cadastro para o documento.
  found: boolean;
  // Razão social ou nome (`name`).
  name: string | null;
  // Situação na Receita Federal.
  registrationStatus: string | null;
  // Nome fantasia (`social_name`), só de empresas.
  tradeName: string | null;
  // Ex.: "RECUPERACAO JUDICIAL" (`special_status`).
  specialStatus: string | null;
};
