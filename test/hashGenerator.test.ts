import { ReadStream } from "fs";
import { generateHash } from "../src/utils/hashGenerator";

describe("generateHash", () => {
  test("should generate the correct hash for a given input", async () => {
    const input = "Hello, World!";
    const reader = ReadStream.from(Buffer.from(input));
    const hash = await generateHash(reader as ReadStream);
    const expectedHash = Buffer.from(
      "0686f0a605973dc1bf035d1e2b9bad1985a0bff712ddd88abd8d2593e5f99030",
      "hex"
    );
    expect(hash).toEqual(expectedHash);
  });
});
