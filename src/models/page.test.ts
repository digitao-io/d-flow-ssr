import { isValueResolved } from "./page";

describe("isValueResolved", () => {
  it("should return true for all the resolved value", () => {
    expect(isValueResolved("hello")).toBe(true);
    expect(isValueResolved(42)).toBe(true);
    expect(isValueResolved(true)).toBe(true);
    expect(isValueResolved([1, 2, 3])).toBe(true);
    expect(isValueResolved(["a", "b"])).toBe(true);
    expect(isValueResolved({ foo: "bar" })).toBe(true);
    expect(isValueResolved({ defaultValue: 0 })).toBe(true);
  });

  it("should return false for data resolving info", () => {
    expect(isValueResolved({ $source: "menu-entries" })).toBe(false);
  });
});
