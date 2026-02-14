import { describe, expect, it } from "vitest";
import { parseSmsCommand } from "./sms-parser";
import { parseLeagueDate } from "./utils";

describe("parseSmsCommand", () => {
  it("parses MM/DD with implied current year", () => {
    const parsed = parseSmsCommand("05/12 G1 St John W Cal Bible L");

    expect(parsed.errors).toEqual([]);
    expect(parsed.isTie).toBe(false);
    expect(parsed.slot).toBe(1);
    expect(parsed.winnerAlias).toBe("St John");
    expect(parsed.loserAlias).toBe("Cal Bible");
    expect(parsed.date).toBe(parseLeagueDate(5, 12));
  });

  it("parses MM/DD/YYYY", () => {
    const parsed = parseSmsCommand("05/12/2026 G2 Saint Johns W Calvary Bible L");

    expect(parsed.errors).toEqual([]);
    expect(parsed.isTie).toBe(false);
    expect(parsed.slot).toBe(2);
    expect(parsed.date).toBe("2026-05-12");
  });

  it("parses tie format with T markers", () => {
    const parsed = parseSmsCommand("05/12 G1 Saint Johns T Calvary Bible T");

    expect(parsed.errors).toEqual([]);
    expect(parsed.isTie).toBe(true);
    expect(parsed.slot).toBe(1);
    expect(parsed.winnerAlias).toBe("Saint Johns");
    expect(parsed.loserAlias).toBe("Calvary Bible");
    expect(parsed.date).toBe(parseLeagueDate(5, 12));
  });

  it("parses tie format with VS phrase", () => {
    const parsed = parseSmsCommand("05/12/2026 G2 St John vs Cal Bible Tie game");

    expect(parsed.errors).toEqual([]);
    expect(parsed.isTie).toBe(true);
    expect(parsed.slot).toBe(2);
    expect(parsed.winnerAlias).toBe("St John");
    expect(parsed.loserAlias).toBe("Cal Bible");
    expect(parsed.date).toBe("2026-05-12");
  });

  it("returns parse errors for invalid messages", () => {
    const parsed = parseSmsCommand("St John won");

    expect(parsed.errors.length).toBeGreaterThan(0);
  });

  it("rejects impossible dates", () => {
    const parsed = parseSmsCommand("02/30 G1 St John W Cal Bible L");

    expect(parsed.errors.length).toBeGreaterThan(0);
  });
});
