import * as tar from "tar";
import {
  PathLike,
  createReadStream,
  createWriteStream,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import { ProgressReport, ProgressReporter } from "../utils/progressReporter";
import { createCompressor, createDecompressor } from "lzma-native";

import { Header } from "./Header";
import { Metadata } from "./Metadata";

import { checkPathExists } from "../utils/checkPath";
import { generateHash } from "../utils/hashGenerator";

import { join } from "path";
import { tmpdir } from "os";

const EMPTY_BUFFER_LENGTH = 0;
const EMPTY_DIR_LENGTH = 0;

interface CreateOptions {
  sourceDirectory: PathLike;
  coverFile: PathLike | Buffer;
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

interface CLBGFileConstructorOptions {
  filePath: PathLike;
  header: Header;
  metadata: Metadata;
  cover: string;
}

/**
 * Represents a CLBG file.
 */
export class CLBGFile {
  filePath: PathLike;
  header: Header;
  metadata: Metadata;
  cover: string;

  /**
   * Creates a new instance of CLBGFile.
   * @param filePath The path of the CLBG file.
   * @param header The header of the CLBG file.
   * @param metadata The metadata of the CLBG file.
   */
  constructor(options: CLBGFileConstructorOptions) {
    this.filePath = options.filePath;
    this.header = options.header;
    this.metadata = options.metadata;
    this.cover = options.cover;
  }

  /**
   * Gets the cover image from a CLBG file.
   * @param targetPath The path of the CLBG file.
   * @param header The header of the CLBG file. If not provided, it will be read from the file.
   * @returns A Promise that resolves to the cover image as a base64 string.
   */
  static async getCoverFromFile(
    targetPath: PathLike,
    header?: Header
  ): Promise<string> {
    const usableHeader = header || (await Header.fromFile(targetPath));

    const coverReadStream = createReadStream(targetPath, {
      end: usableHeader.coverOffset + usableHeader.coverLength,
      start: usableHeader.coverOffset,
    });

    const coverBuffer = Buffer.alloc(usableHeader.coverLength);
    let bytesRead = 0;
    for await (const chunk of coverReadStream) {
      chunk.copy(coverBuffer, bytesRead);
      bytesRead += chunk.length;
    }

    return coverBuffer.toString("base64");
  }

  /**
   * Creates a CLBGFile instance from a file.
   * @param targetPath The path of the CLBG file.
   * @returns A Promise that resolves to a CLBGFile instance.
   */
  static async fromFile(targetPath: PathLike): Promise<CLBGFile> {
    checkPathExists(targetPath, "file");
    const header = await Header.fromFile(targetPath);
    const metadata = await Metadata.fromFile(targetPath, header);
    const cover = await CLBGFile.getCoverFromFile(targetPath, header);

    return new CLBGFile({ cover, filePath: targetPath, header, metadata });
  }

  /**
   * Validates the archive hash of the CLBG file.
   * @returns A Promise that resolves to a boolean indicating whether the archive hash is valid.
   */
  private async validateArchiveHash(
    progressReporter?: ProgressReporter
  ): Promise<boolean> {
    const fileStream = createReadStream(this.filePath, {
      start: this.header.archiveOffset,
    });

    await new Promise((resolve) => {
      fileStream.on("ready", resolve);
    });

    const archiveHash = await generateHash(fileStream, progressReporter);
    return archiveHash.equals(this.header.archiveHash);
  }

  /**
   * Extracts the archive of the CLBG file to a directory.
   * @param targetDirectory The target directory to extract the archive to.
   * @returns A Promise that resolves when the extraction is complete.
   */
  private async extractArchiveToDirectory(
    targetDirectory: PathLike,
    progressReporter: ProgressReporter
  ): Promise<void> {
    const tempFile = join(tmpdir(), `temp-${Date.now()}.tar`);

    progressReporter.advance("decompressing");
    progressReporter.setTotalData(statSync(this.filePath).size);

    const tempStream = createWriteStream(tempFile);
    const fileStream = createReadStream(this.filePath, {
      start: this.header.archiveOffset,
    });

    const decompressor = createDecompressor();
    fileStream.pipe(decompressor).pipe(tempStream);

    await new Promise((resolve, reject) => {
      tempStream.on("close", resolve);
      tempStream.on("error", reject);
      fileStream.on("error", reject);
      fileStream.on("data", (chunk) => {
        progressReporter.updateData(chunk.length);
      });
      decompressor.on("error", reject);
    });

    let tarEntryCount = 0;
    await tar.list({
      file: tempFile,
      onReadEntry: () => {
        tarEntryCount += 1;
      },
    });

    progressReporter.advance("unpacking");
    progressReporter.setTotalData(tarEntryCount);

    await tar.x({
      cwd: targetDirectory.toString(),
      file: tempFile,
      onReadEntry: () => {
        progressReporter.updateData(1);
      },
    });

    rmSync(tempFile);
  }

  /**
   * Extracts the game files from the CLBG file to a target directory.
   * @param targetDirectory The target directory to extract the game files to.
   * @returns A Promise that resolves when the extraction is complete.
   */
  async extractGame(
    targetDirectory: PathLike,
    onProgress?: (progressReport: ProgressReport) => void
  ): Promise<void> {
    const progressReporter = new ProgressReporter({
      callback: onProgress,
      totalSteps: 3,
    });

    checkPathExists(targetDirectory, "directory");

    if (readdirSync(targetDirectory).length > EMPTY_DIR_LENGTH) {
      throw new Error(`Target directory is not empty: ${targetDirectory}`);
    }
    if (!(await this.validateArchiveHash(progressReporter))) {
      throw new Error("Archive hash does not match the one in the header.");
    }

    await this.extractArchiveToDirectory(targetDirectory, progressReporter);

    progressReporter.complete();
  }

  /**
   * Saves the cover image from the CLBG file to a target file.
   * @param targetFile The target file to save the cover image to.
   */
  saveCover(targetFile: PathLike): void {
    const coverBuffer = Buffer.from(this.cover, "base64");
    writeFileSync(targetFile, coverBuffer);
  }

  /**
   * Save metadata to a target file.
   * @param targetFile The target file to save the metadata to.
   */
  saveMetadata(targetFile: PathLike): void {
    writeFileSync(targetFile, this.metadata.toJSON());
  }

  /**
   * Gets the total number of files in a directory.
   * @param directoryPath The path of the directory.
   * @returns The total number of files in the directory.
   */
  static getTotalFiles(directoryPath: PathLike): number {
    const incrementor = 1;
    let totalFiles = 0;
    const files = readdirSync(directoryPath);
    for (const file of files) {
      const filePath = join(directoryPath.toString(), file);
      const stats = statSync(filePath);
      if (stats.isDirectory()) {
        totalFiles += this.getTotalFiles(filePath);
      } else {
        totalFiles += incrementor;
      }
    }
    return totalFiles;
  }

  /**
   * Creates a tar.xz archive of the CLBG file.
   * @returns A Promise that resolves to the path of the created archive file.
   */
  static async createTarXzArchive(
    sourceDirectory: PathLike,
    progressReporter: ProgressReporter
  ): Promise<string> {
    const tempTarFile = join(tmpdir(), `temp-${Date.now()}.tar`);
    const tempXzFile = `${tempTarFile}.xz`;

    progressReporter.advance("packing");
    progressReporter.setTotalData(this.getTotalFiles(sourceDirectory));

    await tar.c(
      {
        cwd: sourceDirectory.toString(),
        file: tempTarFile,
        onWriteEntry: () => {
          progressReporter.updateData(1);
        },
      },
      ["."]
    );

    progressReporter.advance("compressing");
    progressReporter.setTotalData(statSync(tempTarFile).size);

    const compressor = createCompressor();
    const tarStream = createReadStream(tempTarFile);
    const xzStream = createWriteStream(tempXzFile);

    tarStream.pipe(compressor).pipe(xzStream);

    await new Promise((resolve, reject) => {
      xzStream.on("close", resolve);
      xzStream.on("error", reject);
      tarStream.on("error", reject);
      tarStream.on("data", (chunk) => {
        progressReporter.updateData(chunk.length);
      });
      compressor.on("error", reject);
    });

    return tempXzFile;
  }

  /**
   * Writes the CLBG file to disk.
   * @param options The options for writing the CLBG file.
   */

  private static async writeFile(
    options: WriteFileOptions,
    progressReporter: ProgressReporter
  ): Promise<void> {
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
    progressReporter.advance("writing");
    progressReporter.setTotalData(statSync(options.archivePath).size);

    const appendStream = createWriteStream(options.targetFile, { flags: "a" });
    const archiveStream = createReadStream(options.archivePath);
    archiveStream.pipe(appendStream);

    await new Promise((resolve, reject) => {
      archiveStream.on("end", resolve);
      archiveStream.on("data", (chunk) => {
        progressReporter.updateData(chunk.length);
      });
      archiveStream.on("error", reject);
      appendStream.on("error", reject);
    });

    rmSync(options.archivePath);
  }

  /**
   * Creates a CLBG file.
   * @param options The options for creating the CLBG file.
   * @returns A Promise that resolves to a CLBGFile instance.
   */
  static async create(
    options: CreateOptions,
    onProgress?: (progressReport: ProgressReport) => void
  ): Promise<CLBGFile> {
    const progressReporter = new ProgressReporter({
      callback: onProgress,
      totalSteps: 4,
    });

    checkPathExists(options.sourceDirectory, "directory");

    let coverBytes: Buffer = Buffer.alloc(EMPTY_BUFFER_LENGTH);

    if (Buffer.isBuffer(options.coverFile)) {
      coverBytes = options.coverFile;
    } else if (typeof options.coverFile === "string") {
      checkPathExists(options.coverFile, "file");
      coverBytes = readFileSync(options.coverFile);
    }

    const tempFile = await CLBGFile.createTarXzArchive(
      options.sourceDirectory,
      progressReporter
    );
    const archiveStream = createReadStream(tempFile);

    await new Promise((resolve) => {
      archiveStream.on("ready", resolve);
    });

    const archiveHash = await generateHash(archiveStream, progressReporter);

    const header = Header.fromData(
      options.metadata.toBytes(),
      coverBytes,
      archiveHash
    );

    await this.writeFile(
      {
        archivePath: tempFile,
        coverBytes,
        header,
        metadata: options.metadata,
        overwrite: options.overwrite,
        targetFile: options.targetFile,
      },
      progressReporter
    );

    progressReporter.complete();

    return new CLBGFile({
      cover: coverBytes.toString("base64"),
      filePath: options.targetFile,
      header,
      metadata: options.metadata,
    });
  }
}
