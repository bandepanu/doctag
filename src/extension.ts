// pi extension entry point. Registers a `docx_validate` tool the LLM can call and
// a `/docx-validate` slash command. Kept dependency-light: `pi` is typed loosely so
// the package compiles without pi's internal type packages present at build time.
// (At runtime pi provides ExtensionAPI; parameters below are a plain JSON schema,
// which pi accepts.)
import { validatePaths } from "./validate";
import { formatText } from "./core/report";

export default function activate(pi: any): void {
  pi.registerTool({
    name: "docx_validate",
    label: "DocX Validate",
    description:
      "Validate source files against DocX Core-tier tokens (docslim, docdeps, doctype, docpure) using tree-sitter. Returns violations with file/line. Run before finalizing edits.",
    promptSnippet: "Validate files against their DocX contracts before completing a task.",
    parameters: {
      type: "object",
      properties: {
        files: { type: "array", items: { type: "string" }, description: "Paths to validate" },
        config: { type: "string", description: "Optional explicit docx.json path" },
        profile: { type: "string", enum: ["default", "vibe"], description: "'vibe' = Core-only, caps from docx.json only (ignores per-function overrides)" },
      },
      required: ["files"],
    },
    async execute(_id: string, params: any) {
      const { reports, errors } = await validatePaths(params.files ?? [], params.config, { profile: params.profile === "vibe" ? "vibe" : "default" });
      const { text } = formatText(reports);
      return {
        content: [{ type: "text", text }],
        details: { reports, errors },
      };
    },
  });

  pi.registerCommand("docx-validate", {
    description: "Run the DocX validator on the given files",
    handler: async (args: string, ctx: any) => {
      const files = (args || "").split(/\s+/).filter(Boolean);
      const { reports, errors } = await validatePaths(files);
      const { text } = formatText(reports);
      ctx?.ui?.notify?.(`DocX: ${errors} error(s)`, errors ? "error" : "info");
      ctx?.ui?.setWidget?.("docx", text.split("\n"));
    },
  });
}
