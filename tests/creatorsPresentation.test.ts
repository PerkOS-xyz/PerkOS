import { describe, expect, it } from "vitest";
import { creatorAgentLabel, creatorDisplayText, creatorTemplatePathId, creatorTemplateStorageId } from "../app/lib/creatorsPresentation";
import { templateAnswerText, templateQuestionLabel, templateText, type TemplateQuestion } from "../app/lib/projectTemplateTypes";

const question: TemplateQuestion = { id: "artizen-url", label: { en: "Artizen URL", es: "URL Artizen" },
  type: "url", validation: "artizen-url", required: true, maxLength: 500, options: [] };
describe("Creators visible labels", () => {
  it("keeps route aliases reversible without changing other template IDs", () => {
    expect(creatorTemplatePathId("artizen-creator-update")).toBe("creators-update");
    expect(creatorTemplateStorageId("creators-update")).toBe("artizen-creator-update");
    expect(creatorTemplateStorageId("floor-desk")).toBe("floor-desk");
    expect(creatorTemplatePathId("floor-desk")).toBe("floor-desk");
  });
  it("projects legacy labels in each selected language without rewriting user answers", () => {
    const before = structuredClone(question);
    expect(templateQuestionLabel(question, "es-ES")).toBe("URL del proyecto");
    expect(templateQuestionLabel(question, "en-US")).toBe("Project URL");
    expect(templateText({ en: "Artizen updates", es: "Actualizaciones Artizen" }, "es")).toBe("Actualizaciones Creators");
    expect(templateAnswerText(question, "https://artizen.fund/index/p/example", "en")).toBe("https://artizen.fund/index/p/example");
    expect(templateAnswerText({ ...question, type: "text" }, "My Artizen history", "en")).toBe("My Artizen history");
    expect(question).toEqual(before);
  });
  it("provides a safe visible name independently of the managed agent's internal ID", () => {
    expect(creatorAgentLabel("Artizen Creator Companion")).toBe("Creators Companion");
    expect(creatorAgentLabel(" ")).toBe("Creators Companion");
    expect(creatorDisplayText("Hermes")).toBe("Hermes");
  });
});
