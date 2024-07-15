import * as tar from "tar";
import {
  PathLike,
  createReadStream,
  createWriteStream,
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "fs";
import { Header } from "./Header";
import { Metadata } from "./Metadata";
import { checkPathExists } from "../utils/checkPath";
import { generateHash } from "../utils/hashGenerator";
import { join } from "path";
import lzma from "lzma-native";
import { tmpdir } from "os";

const EMPTY_DIR_LENGTH = 0;

interface CreateOptions {
  sourceDirectory: PathLike;
  coverFile: PathLike;
  metadata: Metadata;
  targetFile: PathLike;
  overwrite?: boolean;
}

interface WriteFileOptions {
  header: Header;
  metadata: Metadata;
  coverBytes: Buffer;
  archivePath: PathLike;
  targetFile: PathLike;
  overwrite?: boolean;
}

/**
 * Represents a CLBG file.
 */
export class CLBGFile {
  filePath: PathLike;
  header: Header;
  metadata: Metadata;

  /**
   * Creates a new instance of CLBGFile.
   * @param filePath The path of the CLBG file.
   * @param header The header of the CLBG file.
   * @param metadata The metadata of the CLBG file.
   */
  constructor(filePath: PathLike, header: Header, metadata: Metadata) {
    this.filePath = filePath;
    this.header = header;
    this.metadata = metadata;
  }

  /**
   * Creates a CLBGFile instance from a file.
   * @param targetPath The path of the CLBG file.
   * @returns A Promise that resolves to a CLBGFile instance.
   */
  static async fromFile(targetPath: PathLike): Promise<CLBGFile> {
    checkPathExists(targetPath, "file");
    const header = Header.fromFile(targetPath);
    const metadata = await Metadata.fromFile(targetPath, header);

    return new CLBGFile(targetPath, header, metadata);
  }

  /**
   * Validates the archive hash of the CLBG file.
   * @returns A Promise that resolves to a boolean indicating whether the archive hash is valid.
   */
  private async validateArchiveHash(): Promise<boolean> {
    const fileStream = createReadStream(this.filePath, {
      start: this.header.archiveOffset,
    });

    await new Promise((resolve) => {
      fileStream.on("ready", resolve);
    });

    const archiveHash = await generateHash(fileStream);
    return archiveHash.equals(this.header.archiveHash);
  }

  /**
   * Extracts the archive of the CLBG file to a directory.
   * @param targetDirectory The target directory to extract the archive to.
   * @returns A Promise that resolves when the extraction is complete.
   */
  private async extractArchiveToDirectory(
    targetDirectory: PathLike
  ): Promise<void> {
    const tempFile = join(tmpdir(), `temp-${Date.now()}.tar`);
    const tempStream = createWriteStream(tempFile);
    const fileStream = createReadStream(this.filePath, {
      start: this.header.archiveOffset,
    });

    const decompressor = lzma.createDecompressor();
    fileStream.pipe(decompressor).pipe(tempStream);

    await new Promise((resolve, reject) => {
      tempStream.on("close", resolve);
      tempStream.on("error", reject);
      fileStream.on("error", reject);
      decompressor.on("error", reject);
    });

    await tar.x({
      cwd: targetDirectory.toString(),
      file: tempFile,
    });
  }

  /**
   * Extracts the game files from the CLBG file to a target directory.
   * @param targetDirectory The target directory to extract the game files to.
   * @returns A Promise that resolves when the extraction is complete.
   */
  async extractGame(targetDirectory: PathLike): Promise<void> {
    checkPathExists(targetDirectory, "directory");

    if (readdirSync(targetDirectory).length > EMPTY_DIR_LENGTH) {
      throw new Error(`Target directory is not empty: ${targetDirectory}`);
    }
    if (!(await this.validateArchiveHash())) {
      throw new Error("Archive hash does not match the one in the header.");
    }

    await this.extractArchiveToDirectory(targetDirectory);
  }

  /**
   * Gets the bytes of the cover image from the CLBG file.
   * @returns The bytes of the cover image as a Buffer.
   */
  async getCoverBytes(): Promise<Buffer> {
    const coverReadStream = createReadStream(this.filePath, {
      end: this.header.coverOffset + this.header.coverLength,
      start: this.header.coverOffset,
    });

    const metadataBuffer = Buffer.alloc(this.header.coverLength);
    let bytesRead = 0;
    for await (const chunk of coverReadStream) {
      chunk.copy(metadataBuffer, bytesRead);
      bytesRead += chunk.length;
    }

    return metadataBuffer;
  }

  /**
   * Saves the cover image from the CLBG file to a target file.
   * @param targetFile The target file to save the cover image to.
   */
  async saveCover(targetFile: PathLike): Promise<void> {
    const coverBuffer = await this.getCoverBytes();
    writeFileSync(targetFile, coverBuffer);
  }

  /**
   * Creates a tar.xz archive of the CLBG file.
   * @returns A Promise that resolves to the path of the created archive file.
   */
  static async createTarXzArchive(sourceDirectory: PathLike): Promise<string> {
    const tempTarFile = join(tmpdir(), `temp-${Date.now()}.tar`);
    const tempXzFile = `${tempTarFile}.xz`;

    await tar.c(
      {
        cwd: sourceDirectory.toString(),
        file: tempTarFile,
      },
      ["./"]
    );

    const compressor = lzma.createCompressor();
    const tarStream = createReadStream(tempTarFile);
    const xzStream = createWriteStream(tempXzFile);
    tarStream.pipe(compressor).pipe(xzStream);

    await new Promise((resolve, reject) => {
      xzStream.on("close", resolve);
      xzStream.on("error", reject);
      tarStream.on("error", reject);
      compressor.on("error", reject);
    });

    return tempXzFile;
  }

  /**
   * Writes the CLBG file to disk.
   * @param options The options for writing the CLBG file.
   */
  /* eslint-disable max-statements */
  private static async writeFile(options: WriteFileOptions) {
    if (existsSync(options.targetFile) && !options.overwrite) {
      throw new Error(`Target path already exists: ${options.targetFile}`);
    }

    const writeStream = createWriteStream(options.targetFile);
    writeStream.write(options.header.toBytes());
    writeStream.write(options.metadata.toBytes());
    writeStream.write(options.coverBytes);

    await new Promise<void>((resolve, reject) => {
      writeStream.on("error", reject);
      writeStream.on("finish", resolve);
      writeStream.end();
    });

    const appendStream = createWriteStream(options.targetFile, { flags: "a" });
    const archiveStream = createReadStream(options.archivePath);
    archiveStream.pipe(appendStream);

    await new Promise((resolve, reject) => {
      archiveStream.on("end", resolve);
      archiveStream.on("error", reject);
      appendStream.on("error", reject);
    });
  }

  /**
   * Creates a CLBG file.
   * @param options The options for creating the CLBG file.
   * @returns A Promise that resolves to a CLBGFile instance.
   */
  static async create(options: CreateOptions): Promise<CLBGFile> {
    checkPathExists(options.sourceDirectory, "directory");
    checkPathExists(options.coverFile, "file");

    const coverBytes = readFileSync(options.coverFile);
    const tempFile = await CLBGFile.createTarXzArchive(options.sourceDirectory);
    const archiveStream = createReadStream(tempFile);

    await new Promise((resolve) => {
      archiveStream.on("ready", resolve);
    });

    const archiveHash = await generateHash(archiveStream);

    const header = Header.fromData(
      options.metadata.toBytes(),
      coverBytes,
      archiveHash
    );

    await this.writeFile({
      archivePath: tempFile,
      coverBytes,
      header,
      metadata: options.metadata,
      overwrite: options.overwrite,
      targetFile: options.targetFile,
    });

    return new CLBGFile(options.targetFile, header, options.metadata);
  }
}
