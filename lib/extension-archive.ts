import { readFile } from "node:fs/promises";
import path from "node:path";
const files = [
  "manifest.json",
  "background.js",
  "reader.js",
  "content.js",
  "popup.html",
  "popup.js",
  "options.html",
  "options.js",
  "ui.css",
  "README.txt",
];
function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const b of data) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export async function extensionArchive() {
  const entries = await Promise.all(
    files.map(async (name) => ({
      name: Buffer.from("mentora-vinted/" + name),
      data: await readFile(
        path.join(process.cwd(), "extension/mentora-vinted", name),
      ),
    })),
  );
  const chunks: Buffer[] = [],
    central: Buffer[] = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const crc = crc32(data),
      local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(data.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(name.length, 28);
    dir.writeUInt32LE(offset, 42);
    chunks.push(local, name, data);
    central.push(dir, name);
    offset += local.length + name.length + data.length;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, directory, end]);
}
