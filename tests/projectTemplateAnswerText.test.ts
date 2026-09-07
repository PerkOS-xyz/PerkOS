import { describe, expect, it } from "vitest";
import { templateAnswerText, type TemplateQuestion } from "../app/lib/projectTemplateTypes";

const question: TemplateQuestion = {
  id: "content-language",
  label: { en: "Content language", es: "Idioma del contenido" },
  type: "select",
  required: false,
  maxLength: 10,
  validation: "none",
  options: [{ value: "en", label: { en: "English", es: "Inglés" } }],
};

describe("templateAnswerText", () => {
  it.each([ ["en", "English"], ["es", "Inglés"], ["es-MX", "Inglés"], ["fr", "English"] ])(
    "formats selected options for %s", (locale, expected) => {
      expect(templateAnswerText(question, "en", locale)).toBe(expected);
    },
  );
  it("preserves unknown values and free text without translating them", () => {
    expect(templateAnswerText(question, "unknown", "es")).toBe("unknown");
    expect(templateAnswerText({ ...question, type: "text" }, "en", "es")).toBe("en");
    expect(templateAnswerText({ ...question, type: "textarea" }, "First\nSecond", "es")).toBe("First\nSecond");
  });
  it("uses an empty marker for unanswered optional fields", () => {
    expect(templateAnswerText(question, "", "es")).toBe("—");
    expect(templateAnswerText(question, undefined, "es")).toBe("—");
  });
});
