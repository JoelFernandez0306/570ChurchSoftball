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

  it("parses natural winner phrase with ordinal slot and against", () => {
    const parsed = parseSmsCommand("05/12 1st game St Paul won against St Lukes");

    expect(parsed.errors).toEqual([]);
    expect(parsed.isTie).toBe(false);
    expect(parsed.slot).toBe(1);
    expect(parsed.winnerAlias).toBe("St Paul");
    expect(parsed.loserAlias).toBe("St Lukes");
    expect(parsed.date).toBe(parseLeagueDate(5, 12));
  });

  it("parses natural loser phrase with ordinal slot and misspelled losed", () => {
    const parsed = parseSmsCommand("05/12 2nd game St Paul losed against St Lukes");

    expect(parsed.errors).toEqual([]);
    expect(parsed.isTie).toBe(false);
    expect(parsed.slot).toBe(2);
    expect(parsed.winnerAlias).toBe("St Lukes");
    expect(parsed.loserAlias).toBe("St Paul");
    expect(parsed.date).toBe(parseLeagueDate(5, 12));
  });

  it("parses spaced game slot phrase Game 1", () => {
    const parsed = parseSmsCommand("05/12 Game 1 St John W Cal Bible L");

    expect(parsed.errors).toEqual([]);
    expect(parsed.isTie).toBe(false);
    expect(parsed.slot).toBe(1);
    expect(parsed.winnerAlias).toBe("St John");
    expect(parsed.loserAlias).toBe("Cal Bible");
    expect(parsed.date).toBe(parseLeagueDate(5, 12));
  });

  it("parses spaced game slot phrase Game 2", () => {
    const parsed = parseSmsCommand("05/12/2026 Game 2 St John W Cal Bible L");

    expect(parsed.errors).toEqual([]);
    expect(parsed.isTie).toBe(false);
    expect(parsed.slot).toBe(2);
    expect(parsed.winnerAlias).toBe("St John");
    expect(parsed.loserAlias).toBe("Cal Bible");
    expect(parsed.date).toBe("2026-05-12");
  });

  it("parses slot aliases for game 1", () => {
    const slotVariants = ["game1", "1stgame", "1stGame", "1st Game", "g1", "g 1", "G 1"];

    for (const slotToken of slotVariants) {
      const parsed = parseSmsCommand(`05/12 ${slotToken} St John W Cal Bible L`);

      expect(parsed.errors).toEqual([]);
      expect(parsed.isTie).toBe(false);
      expect(parsed.slot).toBe(1);
      expect(parsed.winnerAlias).toBe("St John");
      expect(parsed.loserAlias).toBe("Cal Bible");
      expect(parsed.date).toBe(parseLeagueDate(5, 12));
    }
  });

  it("parses slot aliases for game 2", () => {
    const slotVariants = ["game2", "2ndgame", "2ndGame", "2nd Game", "g2", "g 2", "G 2"];

    for (const slotToken of slotVariants) {
      const parsed = parseSmsCommand(`05/12 ${slotToken} St John W Cal Bible L`);

      expect(parsed.errors).toEqual([]);
      expect(parsed.isTie).toBe(false);
      expect(parsed.slot).toBe(2);
      expect(parsed.winnerAlias).toBe("St John");
      expect(parsed.loserAlias).toBe("Cal Bible");
      expect(parsed.date).toBe(parseLeagueDate(5, 12));
    }
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
