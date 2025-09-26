import { Buffer } from "buffer";
import { PathLike } from "fs";
import { open } from "fs/promises";

export const HEADER_CONSTANTS = {
  DEFAULT_VERSION: 1,
  DEFAULT_ZERO: 0,
  HEADER_SIZE: 64,
  HEADER_START: 0,
  SIGNATURE: "CLBG\r\n\x1A\n",
};

export const OFFSETS = {
  ARCHIVE_HASH: 32,
  ARCHIVE_OFFSET: 28,
  COVER_LENGTH: 24,
  COVER_OFFSET: 20,
  METADATA_LENGTH: 16,
  METADATA_OFFSET: 12,
  VERSION: 8,
};

export interface HeaderOptions {
  version?: number;
  metadataOffset?: number;
  metadataLength?: number;
  coverOffset?: number;
  coverLength?: number;
  archiveOffset?: number;
  archiveHash?: Buffer;
}

/**
 * Represents the header of a file.
 */
export class Header {
  version: number;
  metadataOffset: number;
  metadataLength: number;
  coverOffset: number;
  coverLength: number;
  archiveOffset: number;
  archiveHash: Buffer;

  /**
   * Creates a new instance of the Header class.
   * @param options - The options to initialize the header.
   */
  constructor(options: HeaderOptions = {}) {
    this.version = options.version || HEADER_CONSTANTS.DEFAULT_VERSION;
    this.metadataOffset =
      options.metadataOffset || HEADER_CONSTANTS.HEADER_SIZE;
    this.metadataLength =
      options.metadataLength || HEADER_CONSTANTS.DEFAULT_ZERO;
    this.coverOffset = options.coverOffset || HEADER_CONSTANTS.DEFAULT_ZERO;
    this.coverLength = options.coverLength || HEADER_CONSTANTS.DEFAULT_ZERO;
    this.archiveOffset = options.archiveOffset || HEADER_CONSTANTS.DEFAULT_ZERO;
    this.archiveHash =
      options.archiveHash || Buffer.alloc(HEADER_CONSTANTS.DEFAULT_ZERO);
  }

  /**
   * Converts the header to a byte buffer.
   * @returns The byte buffer representing the header.
   */
  toBytes(): Buffer {
    const buffer = Buffer.alloc(HEADER_CONSTANTS.HEADER_SIZE);
    buffer.write(
      HEADER_CONSTANTS.SIGNATURE,
      HEADER_CONSTANTS.HEADER_START,
      "ascii"
    );
    buffer.writeUInt32LE(this.version, OFFSETS.VERSION);
    buffer.writeUInt32LE(this.metadataOffset, OFFSETS.METADATA_OFFSET);
    buffer.writeUInt32LE(this.metadataLength, OFFSETS.METADATA_LENGTH);
    buffer.writeUInt32LE(this.coverOffset, OFFSETS.COVER_OFFSET);
    buffer.writeUInt32LE(this.coverLength, OFFSETS.COVER_LENGTH);
    buffer.writeUInt32LE(this.archiveOffset, OFFSETS.ARCHIVE_OFFSET);
    this.archiveHash.copy(buffer, OFFSETS.ARCHIVE_HASH);
    return buffer;
  }

  /**
   * Creates a Header instance from a file.
   * @param filePath - The path to the file.
   * @returns The Header instance created from the file.
   */
  static async fromFile(filePath: PathLike): Promise<Header> {
    const fileHandle = await open(filePath, "r");
    const headerBuffer = Buffer.alloc(HEADER_CONSTANTS.HEADER_SIZE);
    await fileHandle.read(
      headerBuffer,
      0,
      HEADER_CONSTANTS.HEADER_SIZE,
      HEADER_CONSTANTS.HEADER_START
    );
    await fileHandle.close();

    return Header.fromBytes(headerBuffer);
  }

  /**
   * Creates a Header instance from a byte buffer.
   * @param data - The byte buffer representing the header.
   * @returns The Header instance created from the byte buffer.
   */
  static fromBytes(data: Buffer): Header {
    const [
      version,
      metadataOffset,
      metadataLength,
      coverOffset,
      coverLength,
      archiveOffset,
    ] = [
      data.readUInt32LE(OFFSETS.VERSION),
      data.readUInt32LE(OFFSETS.METADATA_OFFSET),
      data.readUInt32LE(OFFSETS.METADATA_LENGTH),
      data.readUInt32LE(OFFSETS.COVER_OFFSET),
      data.readUInt32LE(OFFSETS.COVER_LENGTH),
      data.readUInt32LE(OFFSETS.ARCHIVE_OFFSET),
    ];
    const archiveHash = data.slice(
      OFFSETS.ARCHIVE_HASH,
      HEADER_CONSTANTS.HEADER_SIZE
    );
    return new Header({
      archiveHash,
      archiveOffset,
      coverLength,
      coverOffset,
      metadataLength,
      metadataOffset,
      version,
    });
  }

  /**
   * Creates a Header instance from metadata, cover, and archive hash.
   * @param metadata - The metadata buffer.
   * @param cover - The cover buffer.
   * @param archiveHash - The archive hash buffer.
   * @returns The Header instance created from the provided data.
   */
  static fromData(
    metadata: Buffer,
    cover: Buffer,
    archiveHash: Buffer
  ): Header {
    return new Header({
      archiveHash,
      archiveOffset:
        HEADER_CONSTANTS.HEADER_SIZE + metadata.length + cover.length,
      coverLength: cover.length,
      coverOffset: HEADER_CONSTANTS.HEADER_SIZE + metadata.length,
      metadataLength: metadata.length,
    });
  }
}
