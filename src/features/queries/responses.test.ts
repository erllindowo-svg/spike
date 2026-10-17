import { describe, expect, it } from "vitest";

import type { ResponseList } from "@/lib/judit/schemas/requests";

import { summarizeResponses, summaryText } from "./responses";

// Fictitious items in the documented shapes
// (https://docs.judit.io/schemas/warrant,
// https://docs.judit.io/schemas/penal-execution,
// https://docs.judit.io/requests/requests "summary").
function list(items: unknown[]): ResponseList {
  return {
    page: 1,
    page_count: items.length,
    all_count: items.length,
    all_pages_count: 1,
    page_data: items,
  } as unknown as ResponseList;
}

describe("summarizeResponses", () => {
  it("keeps warrants with the fields the screen shows", () => {
    const summary = summarizeResponses(
      list([
        {
          response_type: "warrant",
          response_data: {
            code: "0000000-39.2026.8.26.0050",
            number: "M-1",
            warrant_type: "Mandado de Prisão",
            arrest_type: "preventive",
            status: "Aguardando Cumprimento",
            issue_date: "2026-01-10T00:00:00.000Z",
          },
        },
      ]),
      null,
    );

    expect(summary.warrants).toEqual([
      {
        code: "0000000-39.2026.8.26.0050",
        number: "M-1",
        warrantType: "Mandado de Prisão",
        arrestType: "preventive",
        status: "Aguardando Cumprimento",
        issueDate: "2026-01-10T00:00:00.000Z",
        expirationDate: null,
        judgementSummary: null,
      },
    ]);
    expect(summary.ignoredResponses).toBe(0);
  });

  it("reads a penal execution as a lawsuit", () => {
    const summary = summarizeResponses(
      list([
        {
          response_type: "execution",
          response_data: {
            code: "0000000-39.2026.8.26.0050",
            tribunal_acronym: "TJSP",
          },
        },
      ]),
      null,
    );

    expect(summary.lawsuits).toHaveLength(1);
    expect(summary.lawsuits[0]).toMatchObject({ tribunal: "TJSP" });
  });

  it("keeps the AI summary as text", () => {
    const summary = summarizeResponses(
      list([
        {
          response_type: "summary",
          response_data: {
            data: ["## Resumo\n\nTexto <strong>fictício</strong>."],
          },
        },
      ]),
      null,
    );

    expect(summary.aiSummary).toBe("## Resumo\n\nTexto fictício.");
  });
});

describe("summaryText", () => {
  it("removes tags instead of interpreting them", () => {
    expect(
      summaryText({
        data: ['<p className="x">Um</p><script>alert(1)</script><br/>Dois'],
      }),
    ).toBe("Um\nalert(1)\nDois");
  });

  it("returns null without text", () => {
    expect(summaryText({ data: [] })).toBeNull();
    expect(summaryText("texto solto")).toBeNull();
  });
});
