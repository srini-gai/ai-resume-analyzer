import { describe, expect, it } from "vitest";
import { analyzeResume } from "./analyzer.js";

describe("analyzeResume", () => {
  it("finds matched and missing skills and returns bounded scores", () => {
    const result = analyzeResume(
      "Summary Skills React TypeScript Experience Built products and improved conversion by 20%. Education",
      "We need a React, TypeScript, Node.js and Docker engineer with communication skills."
    );
    expect(result.matchedSkills).toContain("react");
    expect(result.missingSkills).toContain("docker");
    expect(result.matchScore).toBeGreaterThan(0);
    expect(result.matchScore).toBeLessThanOrEqual(100);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});
