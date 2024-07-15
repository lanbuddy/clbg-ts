import { Header } from "../src/index";

const HASH_SIZE = 0;

describe("Header", () => {
  test("should create a new instance of Header with default values", () => {
    const header = new Header();

    expect(header).toEqual(
      expect.objectContaining({
        archiveHash: Buffer.alloc(HASH_SIZE),
        archiveOffset: 0,
        coverLength: 0,
        coverOffset: 0,
        metadataLength: 0,
        metadataOffset: 64,
        version: 1,
      })
    );
  });
});
