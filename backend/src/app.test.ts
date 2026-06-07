import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";

describe("API", () => {
  it("reports healthy status", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("requires a PDF resume", async () => {
    const response = await request(app)
      .post("/api/analyze")
      .field("jobDescription", "A detailed role description with enough characters to be valid.");
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/PDF resume/i);
  });
});
