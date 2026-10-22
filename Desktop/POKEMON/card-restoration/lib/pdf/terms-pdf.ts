import { parseLegalMarkdown } from "@/lib/legal/legal-doc";
import { buildLegalPdf, blocksToPdf } from "./legal-pdf";

/** The PDF of one Terms version, exactly as stored. */
export function termsPdf(t: { version: string; effectiveLabel: string; markdown: string; sha256: string }) {
  return buildLegalPdf({
    title: `The Card Doc LLC Terms of Service v${t.version}`,
    footer: `The Card Doc LLC - Terms of Service v${t.version} - effective ${t.effectiveLabel}`,
    elements: [
      { type: "small", text: `Terms of Service version ${t.version}, effective ${t.effectiveLabel}. SHA-256 of this text: ${t.sha256}` },
      { type: "rule" },
      ...blocksToPdf(parseLegalMarkdown(t.markdown)),
    ],
  });
}
