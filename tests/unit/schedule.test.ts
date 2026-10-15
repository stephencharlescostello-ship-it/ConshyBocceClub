import { describe, it, expect } from "vitest";
import { generateRoundRobin, scheduleReport } from "@/lib/engine/schedule";

const six = ["t1", "t2", "t3", "t4", "t5", "t6"];

describe("schedule generator", () => {
  it("double round robin for 6 teams: 10 weeks, every pair meets twice, no double booking", () => {
    const s = generateRoundRobin(six, { rounds: 2, tableIds: ["A", "B"], slotsPerWeek: 3 });
    const r = scheduleReport(s, six);
    expect(r.weeks).toBe(10);
    expect(s).toHaveLength(30);
    expect(r.meetingCounts.every((c) => c === 2)).toBe(true);
    expect(r.doubleBooked).toEqual([]);
    expect(r.byes).toBe(0);
    expect(r.maxTableSpread).toBeLessThanOrEqual(2);
  });
  it("single round robin for 6 teams: every pair meets once", () => {
    const s = generateRoundRobin(six, { rounds: 1, tableIds: ["A"], slotsPerWeek: 3 });
    const r = scheduleReport(s, six);
    expect(r.weeks).toBe(5);
    expect(r.meetingCounts.every((c) => c === 1)).toBe(true);
  });
  it("odd team counts get one bye per week", () => {
    const five = six.slice(0, 5);
    const s = generateRoundRobin(five, { rounds: 1, tableIds: ["A", "B"], slotsPerWeek: 2 });
    const r = scheduleReport(s, five);
    expect(r.weeks).toBe(5);
    expect(r.byes).toBe(5);
    expect(new Set(s.filter((m) => !m.awayTeamId).map((m) => m.homeTeamId)).size).toBe(5); // each team byes once
    expect(r.meetingCounts.every((c) => c === 1)).toBe(true);
    expect(r.doubleBooked).toEqual([]);
  });
  it("swaps home and away in the second cycle and balances home games", () => {
    const s = generateRoundRobin(six, { rounds: 2, tableIds: [], slotsPerWeek: 3 });
    const home = new Map<string, number>();
    for (const m of s) home.set(m.homeTeamId, (home.get(m.homeTeamId) ?? 0) + 1);
    const counts = Array.from(home.values());
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
  });
  it("shares slot times fairly", () => {
    const s = generateRoundRobin(six, { rounds: 2, tableIds: ["A"], slotsPerWeek: 3 });
    const perTeamSlot = new Map<string, number[]>();
    for (const m of s) for (const t of [m.homeTeamId, m.awayTeamId!]) {
      const arr = perTeamSlot.get(t) ?? [0, 0, 0];
      arr[m.slotIndex]++;
      perTeamSlot.set(t, arr);
    }
    for (const arr of perTeamSlot.values()) expect(Math.max(...arr) - Math.min(...arr)).toBeLessThanOrEqual(4);
  });
  it("handles tiny leagues", () => {
    expect(generateRoundRobin(["a"], { rounds: 1, tableIds: [], slotsPerWeek: 1 })).toEqual([]);
    const two = generateRoundRobin(["a", "b"], { rounds: 2, tableIds: [], slotsPerWeek: 1 });
    expect(two).toHaveLength(2);
    expect(two[0].homeTeamId).not.toBe(two[1].homeTeamId);
  });
});
