// Bodies taken from documented examples, shortened. All data is fictitious.

// https://docs.judit.io/cache-judit/hotstorage ("Exemplo completo de resposta")
export const hotStorageBody = {
  has_lawsuits: true,
  request_id: "c37cacba-41b5-4694-919f-4a937f2ea5df",
  response_data: [
    {
      code: "9999999-99.9999.9.99.9999",
      justice: "5",
      tribunal: "01",
      instance: 2,
      distribution_date: "2023-05-18T11:12:59.000Z",
      tribunal_acronym: "TRT1",
      secrecy_level: 0,
      parties: [
        {
          name: "Usuário teste",
          side: "Active",
          person_type: "Autor",
          was_inferred: false,
        },
      ],
      steps: [],
      attachments: [],
      related_lawsuits: [],
      amount: 7685.82,
      last_step: {
        lawsuit_cnj: "9999999-99.9999.9.99.9999",
        lawsuit_instance: 2,
        step_id: "JZzfEPTs10aeE+vpu+p+bkrz5K7enJhAM5kWattktHk=",
        step_date: "2024-03-18T19:21:02.466Z",
        private: false,
        steps_count: 1,
      },
      name: "Nome do Autor X Nome do Réu",
    },
  ],
};

// https://docs.judit.io/cache-judit/count ("Passo 2: Ler a resposta")
export const countBody = { total: 12 };

// https://docs.judit.io/cache-judit/cache-grouped ("Exemplo de resposta")
export const syntheticBody = {
  classifications: [{ count: 1, value: "PROCEDIMENTO COMUM CÍVEL" }],
  areas: [{ count: 4, value: "DIREITO CIVIL" }],
  tribunals: [{ count: 8, value: "TRT1" }],
  phases: [{ count: 11, value: "INICIAL" }],
  lawsuits_count: 27,
};

// https://docs.judit.io/registration-data/registration-data
// ("Resposta por CNPJ")
export const entityCnpjBody = {
  has_lawsuits: false,
  request_id: "6e5a24f7-f874-4234-8acc-419142e2b066",
  response_data: [
    {
      entity_id: "",
      entity_type: "company",
      main_document: "99.999.999/0009-99",
      name: "FINGI - EM RECUPERACAO JUDICIAL",
      social_name: "FING",
      head_office: true,
      revenue_service_active: true,
      special_status: "RECUPERACAO JUDICIAL",
    },
  ],
};

// Real POST /lawsuits response for the fictitious test CNPJ A1B2C3D4/E5F6-68,
// observed on 2026-10-14 (empty arrays and crawler/tags metadata omitted).
// The list field name is shown as `lawsuits`, but it was observed after our
// transform, so the raw name is still unknown (README, contradiction 10).
export const hotStorageObservedBody = {
  has_lawsuits: true,
  request_id: "2bf22fa7-4061-4ea6-8e69-b479bc12c24c",
  lawsuits: [
    {
      code: "0000000-39.2026.8.26.0050",
      instance: 1,
      name: "PARTE TESTE X EMPRESA TESTE",
      tribunal_acronym: "TJSP",
      distribution_date: "2026-05-01T03:00:00.000Z",
      amount: 0,
      secrecy_level: 0,
      justice: "8",
      justice_description: "JUSTIÇA ESTADUAL",
      tribunal: "26",
      county: "20 CRIMINAL DE CENTRAL",
      state: "SP",
      city: "SAO PAULO",
      area: "NÃO INFORMADO",
      classifications: [],
      subjects: [],
      courts: [],
      parties: [
        {
          main_document: "A1B2C3D4E5F668",
          name: "EMPRESA TESTE",
          side: "Passive",
          person_type: "RÉU",
          documents: [{ document: "A1B2C3D4E5F668", document_type: "cnpj" }],
          lawyers: [],
        },
        {
          name: "PARTE TESTE",
          side: "Active",
          person_type: "AUTOR",
          documents: [],
          lawyers: [],
        },
      ],
      situation: "NÃO INFORMADO",
      judge: "NÃO INFORMADO",
      steps: [],
    },
  ],
};
