import { checkPathExists } from "../src/utils/checkPath";

describe("checkPath", () => {
  test("should throw an error if the path does not exist", () => {
    expect(() => {
      checkPathExists("nonexistent", "file");
    }).toThrow("Target path does not exist");
  });

  test("should throw an error if the path is not a file", () => {
    expect(() => {
      checkPathExists(__dirname, "file");
    }).toThrow("Path is not a file");
  });

  test("should throw an error if the path is not a directory", () => {
    expect(() => {
      checkPathExists(__filename, "directory");
    }).toThrow("Path is not a directory");
  });
});
