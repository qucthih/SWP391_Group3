import { describe, it, expect, vi } from "vitest";

// Mock logger
vi.mock("../src/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const { analyzeRepository } =
  await import("../src/services/git-analytics.service.js");

describe("Git Analytics Service (US-11)", () => {
  // ── Mock Mode ──────────────────────────────────────────────────────────
  it("should return mock data when forceMock is true", async () => {
    const result = await analyzeRepository(
      "https://github.com/example/SWP391_Group3",
      { forceMock: true },
    );

    expect(result.repository).toBe("example/SWP391_Group3");
    expect(result.totalCommits).toBeGreaterThan(0);
    expect(result.memberStats).toBeInstanceOf(Array);
    expect(result.memberStats.length).toBeGreaterThan(0);
    expect(result.analyzedAt).toBeTruthy();

    // Verify member stats structure
    for (const member of result.memberStats) {
      expect(member).toHaveProperty("author");
      expect(member).toHaveProperty("commits");
      expect(member).toHaveProperty("additions");
      expect(member).toHaveProperty("deletions");
      expect(typeof member.commits).toBe("number");
      expect(typeof member.additions).toBe("number");
      expect(typeof member.deletions).toBe("number");
    }
  });

  // ── URL Parsing ────────────────────────────────────────────────────────
  it("should parse various GitHub URL formats", async () => {
    const urls = [
      "https://github.com/owner/repo",
      "https://github.com/owner/repo.git",
      "https://github.com/owner/repo/",
      "http://github.com/owner/repo",
      "github.com/owner/repo",
    ];

    for (const url of urls) {
      const result = await analyzeRepository(url, { forceMock: true });
      expect(result.repository).toBe("owner/repo");
    }
  });

  // ── Invalid URL ────────────────────────────────────────────────────────
  it("should throw for invalid GitHub URLs", async () => {
    await expect(
      analyzeRepository("https://gitlab.com/owner/repo", { forceMock: true }),
    ).rejects.toThrow("Invalid GitHub URL");

    await expect(
      analyzeRepository("not-a-url", { forceMock: true }),
    ).rejects.toThrow("Invalid GitHub URL");
  });

  // ── Fallback behavior ─────────────────────────────────────────────────
  it("should gracefully fall back to mock data when API is unreachable", async () => {
    // Without forceMock, it tries the real API which should fail
    // (no internet or rate limited) and fall back to mock data
    const result = await analyzeRepository(
      "https://github.com/nonexistent-org-xyz/nonexistent-repo-abc-12345",
    );

    // Should still return valid structure (mock fallback)
    expect(result.repository).toBeTruthy();
    expect(result.totalCommits).toBeGreaterThanOrEqual(0);
    expect(result.memberStats).toBeInstanceOf(Array);
  });
});
