import { beforeEach, describe, expect, it } from "vitest";

import { activitySessionId } from "../app/lib/activityTelemetry";

describe("activity telemetry session", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("reuses one id for the browser tab instead of counting rerenders", () => {
    const first = activitySessionId("app");
    expect(activitySessionId("app")).toBe(first);
    expect(activitySessionId("grow")).not.toBe(first);
  });
});
