import { describe, expect, it } from "vitest";

import { checkDeliveries, missingDeliveries } from "./deliveries";

// Envelopes gravados (fictícios), no formato de envelope.ts.
const lawsuit = {
  payload: { response_type: "lawsuit", response_data: { omitted: true } },
};
const completed = {
  payload: { response_type: "application_info", response_data: { code: 600 } },
};
const notFound = {
  payload: {
    response_type: "application_error",
    response_data: { code: 2, message: "LAWSUIT_NOT_FOUND" },
  },
};

describe("checkDeliveries", () => {
  it("counts responses apart from the completion notice", () => {
    const check = checkDeliveries(2, [lawsuit, notFound, completed]);
    expect(check).toEqual({ expected: 2, received: 2, completionNotice: true });
    expect(missingDeliveries(check)).toBe(0);
  });

  it("reports what is missing", () => {
    const check = checkDeliveries(3, [lawsuit]);
    expect(check.completionNotice).toBe(false);
    expect(missingDeliveries(check)).toBe(2);
  });

  it("never reports a negative gap", () => {
    expect(missingDeliveries(checkDeliveries(0, [lawsuit]))).toBe(0);
  });
});
