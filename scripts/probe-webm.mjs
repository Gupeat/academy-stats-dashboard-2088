#!/usr/bin/env node
/**
 * 录屏探针：解析 WebM/Matroska 的 EBML 结构，校验容器、视频轨与精确时长。
 * 不依赖系统 ffprobe，保证在干净环境也能复跑。
 *
 * 用法：node scripts/probe-webm.mjs [path]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.resolve(process.argv[2] ?? path.join(ROOT, "docs", "recordings", "ac3-venue-switch.webm"));
const MIN = 8;
const MAX = 15;
const MIN_BYTES = 100000;

const ID = {
  EBML: 0x1a45dfa3,
  SEGMENT: 0x18538067,
  INFO: 0x1549a966,
  TIMECODE_SCALE: 0x2ad7b1,
  DURATION: 0x4489,
  TRACKS: 0x1654ae6b,
  TRACK_ENTRY: 0xae,
  CODEC_ID: 0x86,
  CLUSTER: 0x1f43b675,
  TIMECODE: 0xe7,
  SIMPLE_BLOCK: 0xa3,
  BLOCK_GROUP: 0xa0,
};
const MASTER = new Set([ID.EBML, ID.SEGMENT, ID.INFO, ID.TRACKS, ID.TRACK_ENTRY, ID.CLUSTER, ID.BLOCK_GROUP]);

function readId(buffer, offset) {
  const first = buffer[offset];
  if (first === undefined) return null;
  let length = 1;
  let mask = 0x80;
  while (length <= 4 && (first & mask) === 0) {
    length += 1;
    mask >>= 1;
  }
  if (length > 4 || offset + length > buffer.length) return null;
  let value = 0;
  for (let index = 0; index < length; index += 1) value = value * 256 + buffer[offset + index];
  return { value, length };
}

function readSize(buffer, offset) {
  const first = buffer[offset];
  if (first === undefined) return null;
  let length = 1;
  let mask = 0x80;
  while (length <= 8 && (first & mask) === 0) {
    length += 1;
    mask >>= 1;
  }
  if (length > 8 || offset + length > buffer.length) return null;
  let value = first & (mask - 1);
  let unknown = value === mask - 1;
  for (let index = 1; index < length; index += 1) {
    value = value * 256 + buffer[offset + index];
    if (buffer[offset + index] !== 0xff) unknown = false;
  }
  return { value, length, unknown };
}

function readUint(buffer, start, end) {
  let value = 0;
  for (let index = start; index < end; index += 1) value = value * 256 + buffer[index];
  return value;
}

function readFloat(buffer, start, end) {
  const length = end - start;
  if (length === 4) return buffer.readFloatBE(start);
  if (length === 8) return buffer.readDoubleBE(start);
  return null;
}

if (!fs.existsSync(file)) {
  console.error("FAIL 录屏不存在: " + file);
  process.exit(1);
}
const buffer = fs.readFileSync(file);
if (buffer.length <= MIN_BYTES) {
  console.error("FAIL 录屏文件过小: " + buffer.length + " 字节");
  process.exit(1);
}
const head = buffer.subarray(0, 4);
if (!(head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3)) {
  console.error("FAIL 不是 WebM/Matroska 容器（EBML 头不匹配）");
  process.exit(1);
}

const parsed = {
  sawSegment: false,
  timecodeScale: 1000000,
  duration: null,
  codecs: [],
  clusters: 0,
  lastClusterTimecode: 0,
  lastBlockRelative: 0,
};

function walk(start, end) {
  let offset = start;
  while (offset < end) {
    const id = readId(buffer, offset);
    if (!id) return;
    const size = readSize(buffer, offset + id.length);
    if (!size) return;
    const dataStart = offset + id.length + size.length;
    const dataEnd = size.unknown ? end : dataStart + size.value;
    if (dataEnd > end || dataEnd < dataStart) return;

    if (id.value === ID.SEGMENT) parsed.sawSegment = true;
    if (id.value === ID.TIMECODE_SCALE) parsed.timecodeScale = readUint(buffer, dataStart, dataEnd);
    if (id.value === ID.DURATION) parsed.duration = readFloat(buffer, dataStart, dataEnd);
    if (id.value === ID.CODEC_ID) parsed.codecs.push(buffer.subarray(dataStart, dataEnd).toString("utf8"));
    if (id.value === ID.CLUSTER) parsed.clusters += 1;
    if (id.value === ID.TIMECODE) parsed.lastClusterTimecode = readUint(buffer, dataStart, dataEnd);
    if (id.value === ID.SIMPLE_BLOCK) {
      const trackSize = readSize(buffer, dataStart);
      if (trackSize) {
        const relativeOffset = dataStart + trackSize.length;
        if (relativeOffset + 2 <= dataEnd) {
          parsed.lastBlockRelative = Math.max(parsed.lastBlockRelative, buffer.readInt16BE(relativeOffset));
        }
      }
    }
    if (MASTER.has(id.value)) walk(dataStart, dataEnd);
    if (size.unknown) return;
    offset = dataEnd;
  }
}

walk(0, buffer.length);

const videoCodecs = parsed.codecs.filter((codec) => codec.startsWith("V_"));
if (!parsed.sawSegment) {
  console.error("FAIL 缺少 Matroska Segment");
  process.exit(1);
}
if (parsed.clusters === 0) {
  console.error("FAIL 缺少 Cluster，录屏没有媒体数据");
  process.exit(1);
}
if (videoCodecs.length === 0) {
  console.error("FAIL 缺少视频轨（CodecID 未找到 V_*）");
  process.exit(1);
}

const durationFromHeader =
  Number.isFinite(parsed.duration) && parsed.duration > 0
    ? (parsed.duration * parsed.timecodeScale) / 1e9
    : null;
const durationFromClusters =
  ((parsed.lastClusterTimecode + Math.max(0, parsed.lastBlockRelative)) * parsed.timecodeScale) / 1e9;
const duration = durationFromHeader ?? durationFromClusters;
const durationSource = durationFromHeader === null ? "clusters" : "segment-info";

if (!Number.isFinite(duration)) {
  console.error("FAIL 无法读取录屏时长（Duration 与 Cluster 均不可用）");
  process.exit(1);
}
if (duration < MIN || duration > MAX) {
  console.error(
    "FAIL 录屏时长不符合 8–15 秒真实录屏要求（实际 " + duration.toFixed(2) + "s，" + buffer.length + " 字节）",
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      file: path.relative(ROOT, file).split(path.sep).join("/"),
      format: "matroska,webm",
      codec: videoCodecs[0],
      clusters: parsed.clusters,
      duration: Number(duration.toFixed(3)),
      durationSource,
      size: buffer.length,
      min: MIN,
      max: MAX,
    },
    null,
    2,
  ),
);
console.log("RESULT: PASS 录屏 " + duration.toFixed(2) + "s，" + buffer.length + " 字节，容器 matroska,webm");
