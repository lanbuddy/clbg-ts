import { Metadata } from "../src/index";

describe("Metadata", () => {
  test("should create a new instance of Metadata with default values", () => {
    const metadata = new Metadata({
      igdbId: 1,
      name: "Test",
    });

    expect(metadata).toEqual(
      expect.objectContaining({
        description: "",
        developer: "",
        genres: [],
        igdbId: 1,
        keywords: [],
        name: "Test",
        publisher: "",
        rating: 0,
        releaseDate: "",
        server: false,
        themes: [],
      })
    );
  });
});
