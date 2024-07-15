import { Readable } from "stream";
import { generateHash } from "../src/utils/hashGenerator";

describe("generateHash", () => {
  test("should generate the correct hash for a given input", async () => {
    const input = "Hello, World!";
    const reader = Readable.from(Buffer.from(input));
    const hash = await generateHash(reader);
    const expectedHash = Buffer.from(
      "ec9db904d636ef61f1421b2ba47112a4fa6b8964fd4a0a514834455c21df7812",
      "hex"
    );
    expect(hash).toEqual(expectedHash);
  });
});
