import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SIGNED_IN = "0xec6061e56be289561c38755d44ceadde70251cbc";
const PROJECT_OWNER = "0xc2564e41b7f5cb66d2d99466450cfebce9e8228f";

const uploadAttachment = vi.fn();

vi.mock("../app/lib/uploadAttachment", () => ({
  uploadAttachment: (...args: unknown[]) => uploadAttachment(...args),
  MAX_ATTACHMENT_BYTES: 25 * 1024 * 1024,
}));

vi.mock("../app/lib/useAppAccount", () => ({
  useAppAccount: () => ({ address: SIGNED_IN, isConnected: true }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), warning: vi.fn() },
}));

import { TaskAttachments } from "../app/components/TaskAttachments";

/**
 * Storage rules key the upload to the PATH: `request.auth.uid == wallet`. The
 * only wallet that can ever work is the signed-in one.
 *
 * The first version of this component took the wallet as a prop and the call
 * sites passed the project OWNER — correct for the Firestore write, wrong
 * here — so every org member who was not the owner got
 * `storage/unauthorized` on a control the UI had already shown them.
 */
describe("TaskAttachments upload path", () => {
  beforeEach(() => {
    uploadAttachment.mockReset();
    uploadAttachment.mockResolvedValue({
      name: "shot.png",
      url: "https://example.test/shot.png",
      contentType: "image/png",
      isImage: true,
      size: 10,
    });
  });

  it("uploads under the signed-in wallet, not the project owner", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <TaskAttachments scope="project-id" value={[]} onChange={onChange} />,
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "shot.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(uploadAttachment).toHaveBeenCalledTimes(1));
    const arg = uploadAttachment.mock.calls[0][0] as { walletAddress: string };
    expect(arg.walletAddress).toBe(SIGNED_IN);
    expect(arg.walletAddress).not.toBe(PROJECT_OWNER);
  });

  it("hands the uploaded file back to the caller", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <TaskAttachments scope="project-id" value={[]} onChange={onChange} />,
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["x"], "shot.png", { type: "image/png" })] },
    });

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange.mock.calls[0][0]).toHaveLength(1);
  });

  it("offers the control without needing a wallet prop", () => {
    render(<TaskAttachments scope="project-id" value={[]} onChange={vi.fn()} />);
    expect(screen.getByRole("button")).toBeVisible();
  });
});
