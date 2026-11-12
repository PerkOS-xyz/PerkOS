import { describe, expect, it, vi } from "vitest";

// The data layer is not under test: only the rule that reads two memberships.
vi.mock("../app/lib/firebase", () => ({ firebaseDb: () => ({}), firebaseAuth: () => ({}) }));

import { projectStanding } from "../app/lib/projectAccess";

const OWNER = "0xAbCdEf0123456789aBcDeF0123456789AbCdEf01";
const ME = "0x1111111111111111111111111111111111111111";

describe("what a person may do in someone else's project", () => {
  it("lets the owner write, however the address is written", () => {
    expect(projectStanding({ me: OWNER.toLowerCase(), owner: OWNER })).toBe("write");
  });

  it("lets an editor write, from the project or from its organization", () => {
    expect(projectStanding({ me: ME, owner: OWNER, project: { role: "editor", status: "active" } })).toBe("write");
    expect(projectStanding({ me: ME, owner: OWNER, organization: { role: "editor" } })).toBe("write");
  });

  it("takes the higher of the two roles", () => {
    expect(projectStanding({ me: ME, owner: OWNER, project: { role: "viewer" }, organization: { role: "editor" } })).toBe("write");
    expect(projectStanding({ me: ME, owner: OWNER, project: { role: "editor" }, organization: { role: "viewer" } })).toBe("write");
  });

  it("keeps a Read only member reading", () => {
    expect(projectStanding({ me: ME, owner: OWNER, project: { role: "viewer" } })).toBe("read");
    expect(projectStanding({ me: ME, owner: OWNER, project: { role: "viewer" }, organization: { role: "viewer" } })).toBe("read");
  });

  it("does not count a role that was taken away, or one it does not know", () => {
    expect(projectStanding({ me: ME, owner: OWNER, project: { role: "editor", status: "removed" } })).toBe("read");
    expect(projectStanding({ me: ME, owner: OWNER, organization: { role: "anything" } })).toBe("read");
    expect(projectStanding({ me: ME, owner: OWNER })).toBe("read");
    expect(projectStanding({ me: ME, owner: OWNER, project: null, organization: undefined })).toBe("read");
  });
});
