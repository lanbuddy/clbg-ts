import { CLBGFile, Metadata } from "../src/index";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const HASH_SIZE = 32;
const PNG_FILE =
  "89504e470d0a1a0a0000000d49484452000000300000002501000000002c6257020000000a4944415478016318050001030001454103b50000000049454e44ae426082";
const TXT_FILE = "The quick brown fox jumps over the lazy dog.";
const METADATA = new Metadata({
  description: "A test game for testing purposes.",
  developer: "Test Developer",
  genres: ["Adventure", "Shooter"],
  igdbId: 1,
  keywords: ["post-apocalyptic"],
  name: "Test",
  publisher: "Test Publisher",
  rating: 4.5,
  releaseDate: "2024-01-01",
  server: true,
  themes: ["Action", "Horror", "Survival"],
});

const TEMPORARY_TEST_DIRECTORY = join(tmpdir(), "/clbgfile-test/");
const INPUT_DIRECTORY = join(TEMPORARY_TEST_DIRECTORY, "/input/");
const OUTPUT_DIRECTORY = join(TEMPORARY_TEST_DIRECTORY, "/output/");
const COVER_FILE = join(TEMPORARY_TEST_DIRECTORY, "test_cover.png");
const TEXT_FILE = join(INPUT_DIRECTORY, "test_text.txt");
const SECOND_TEXT_FILE = join(INPUT_DIRECTORY, "test_text2.txt");
const TARGET_FILE = join(TEMPORARY_TEST_DIRECTORY, "test.clbg");

/* eslint-disable max-lines-per-function */
describe("CLBGFile", () => {
  beforeAll(async () => {
    if (existsSync(TEMPORARY_TEST_DIRECTORY)) {
      rmSync(TEMPORARY_TEST_DIRECTORY, { recursive: true });
    }
    mkdirSync(TEMPORARY_TEST_DIRECTORY);
    mkdirSync(INPUT_DIRECTORY);
    mkdirSync(OUTPUT_DIRECTORY);
    writeFileSync(COVER_FILE, Buffer.from(PNG_FILE, "hex"));
    writeFileSync(TEXT_FILE, Buffer.from(TXT_FILE, "utf-8"));
    writeFileSync(SECOND_TEXT_FILE, Buffer.from(TXT_FILE, "utf-8"));

    await CLBGFile.create({
      coverFile: COVER_FILE,
      metadata: METADATA,
      overwrite: true,
      sourceDirectory: INPUT_DIRECTORY,
      targetFile: TARGET_FILE,
    });
  });

  describe("create", () => {
    test("should create a valid CLBG file", async () => {
      const clbgFile = await CLBGFile.create({
        coverFile: COVER_FILE,
        metadata: METADATA,
        overwrite: true,
        sourceDirectory: INPUT_DIRECTORY,
        targetFile: TARGET_FILE,
      });

      const createdFile = await CLBGFile.fromFile(TARGET_FILE);
      expect(createdFile.header).toEqual(clbgFile.header);
      expect(createdFile.metadata).toEqual(clbgFile.metadata);
      expect(createdFile.cover).toEqual(clbgFile.cover);

      await createdFile.extractGame(OUTPUT_DIRECTORY);

      expect(
        readFileSync(join(OUTPUT_DIRECTORY, "test_text.txt"), "utf-8")
      ).toEqual(TXT_FILE);

      rmSync(OUTPUT_DIRECTORY, { recursive: true });
      mkdirSync(OUTPUT_DIRECTORY);
    });

    test("should overwrite an existing target file if overwrite is true", async () => {
      await CLBGFile.create({
        coverFile: COVER_FILE,
        metadata: METADATA,
        overwrite: true,
        sourceDirectory: INPUT_DIRECTORY,
        targetFile: TARGET_FILE,
      });
    });

    test("should not overwrite an existing target file if overwrite is false", async () => {
      await expect(async () => {
        await CLBGFile.create({
          coverFile: Buffer.from(PNG_FILE, "hex"),
          metadata: METADATA,
          overwrite: false,
          sourceDirectory: INPUT_DIRECTORY,
          targetFile: TARGET_FILE,
        });
      }).rejects.toThrow("Target path already exists");
    });
  });

  describe("extractGame", () => {
    test("should trow an error if the target directory is not empty", async () => {
      writeFileSync(
        join(OUTPUT_DIRECTORY, "test.txt"),
        Buffer.from(TXT_FILE, "utf-8")
      );

      const clbgFile = await CLBGFile.fromFile(TARGET_FILE);

      expect(async () => {
        await clbgFile.extractGame(OUTPUT_DIRECTORY);
      }).rejects.toThrow("Target directory is not empty");

      rmSync(join(OUTPUT_DIRECTORY, "test.txt"));
    });

    test("should throw an error if the archive hash does not match the one in the header", async () => {
      const clbgFile = await CLBGFile.fromFile(TARGET_FILE);
      clbgFile.header.archiveHash = Buffer.alloc(HASH_SIZE);

      expect(async () => {
        await clbgFile.extractGame(OUTPUT_DIRECTORY);
      }).rejects.toThrow("Archive hash does not match the one in the header.");
    });
  });

  describe("saveCover", () => {
    test("should save the cover image to a target file", async () => {
      const clbgFile = await CLBGFile.fromFile(TARGET_FILE);
      rmSync(COVER_FILE);
      await clbgFile.saveCover(COVER_FILE);
      expect(clbgFile.cover).toEqual(
        Buffer.from(PNG_FILE, "hex").toString("base64")
      );
    });
  });

  describe("saveMetadata", () => {
    test("should save the metadata to a target file", async () => {
      const clbgFile = await CLBGFile.fromFile(TARGET_FILE);
      const metadataFile = join(TEMPORARY_TEST_DIRECTORY, "metadata.json");
      await clbgFile.saveMetadata(metadataFile);
      const metadata = readFileSync(metadataFile, "utf-8");
      expect(metadata).toEqual(METADATA.toJSON());
    });
  });

  describe("extractCoverFromFile", () => {
    test("should extract the cover image from a CLBG file", async () => {
      const cover = await CLBGFile.getCoverFromFile(TARGET_FILE);
      expect(cover).toEqual(Buffer.from(PNG_FILE, "hex").toString("base64"));
    });
  });

  describe("getTotalFiles", () => {
    test("should return the total number of files in a directory", () => {
      const expectedFileCount = 5;
      const totalFiles = CLBGFile.getTotalFiles(TEMPORARY_TEST_DIRECTORY);

      expect(totalFiles).toBe(expectedFileCount);
    });
  });

  afterAll(() => {
    rmSync(TEMPORARY_TEST_DIRECTORY, { recursive: true });
  });
});
