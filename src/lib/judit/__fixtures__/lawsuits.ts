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
