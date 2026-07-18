import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/";
let sessionStatus = "signed-in";
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace }),
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => <span data-image={props.alt} />,
}));

vi.mock("../app/lib/useWalletSession", () => ({
  useWalletSession: () => ({ status: sessionStatus }),
}));

import { LandingAutoRoute } from "../app/components/LandingAutoRoute";

describe("LandingAutoRoute", () => {
  beforeEach(() => {
    pathname = "/";
    sessionStatus = "signed-in";
    replace.mockReset();
    window.history.replaceState({}, "", "/");
  });

  it("redirects a signed-in user who opens the landing", async () => {
    render(<LandingAutoRoute />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  it.each([
    "/projects/project-id",
    "/projects/project-id?tab=chat",
    "/agents/agent-id",
    "/chat/conversation-id",
  ])("does not override a signed-in deep link to %s", async (route) => {
    pathname = route.split("?")[0];
    window.history.replaceState({}, "", route);

    render(<LandingAutoRoute />);

    await waitFor(() => expect(replace).not.toHaveBeenCalled());
  });

  it("trusts the browser URL while the Next pathname is stale during hydration", async () => {
    pathname = "/";
    window.history.replaceState({}, "", "/projects/project-id?tab=chat");

    render(<LandingAutoRoute />);

    await waitFor(() => expect(replace).not.toHaveBeenCalled());
  });

  it("keeps an explicit home request on the landing", async () => {
    window.history.replaceState({}, "", "/?home");

    render(<LandingAutoRoute />);

    await waitFor(() => expect(replace).not.toHaveBeenCalled());
  });
});
