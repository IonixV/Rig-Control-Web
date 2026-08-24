// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  classifyLinuxDeviceName,
  naturalSortByTrailingNumber,
  orderLinuxDeviceNames,
  parseProcTtyDriverSerial,
  parseWindowsSerialCommRegistry,
  shouldIncludeTtyS,
} from "./serial.ts";

describe("parseWindowsSerialCommRegistry", () => {
  it("extracts COM port names from reg query output", () => {
    const output = [
      "HKEY_LOCAL_MACHINE\\HARDWARE\\DEVICEMAP\\SERIALCOMM",
      "    \\Device\\VCP0    REG_SZ    COM3",
      "    \\Device\\Serial0    REG_SZ    COM1",
      "",
    ].join("\r\n");
    expect(parseWindowsSerialCommRegistry(output)).toEqual(["COM1", "COM3"]);
  });

  it("sorts numerically, not lexicographically", () => {
    const output = [
      "    \\Device\\VCP0    REG_SZ    COM10",
      "    \\Device\\VCP1    REG_SZ    COM2",
    ].join("\r\n");
    expect(parseWindowsSerialCommRegistry(output)).toEqual(["COM2", "COM10"]);
  });

  it("returns an empty list when there is no matching key/output", () => {
    expect(parseWindowsSerialCommRegistry("")).toEqual([]);
    expect(parseWindowsSerialCommRegistry("ERROR: The system was unable to find the specified registry key.")).toEqual([]);
  });
});

describe("classifyLinuxDeviceName", () => {
  it("matches ttyUSB, ttyACM, and ttyS device names", () => {
    expect(classifyLinuxDeviceName("ttyUSB0")).toBe(true);
    expect(classifyLinuxDeviceName("ttyACM3")).toBe(true);
    expect(classifyLinuxDeviceName("ttyS0")).toBe(true);
  });

  it("rejects unrelated /dev entries", () => {
    expect(classifyLinuxDeviceName("ttyUSB")).toBe(false);
    expect(classifyLinuxDeviceName("sda1")).toBe(false);
    expect(classifyLinuxDeviceName("ttyprintk")).toBe(false);
    expect(classifyLinuxDeviceName("random0")).toBe(false);
  });
});

describe("parseProcTtyDriverSerial", () => {
  it("keeps only ports with a real (non-unknown) detected UART type", () => {
    const text = [
      "serinfo:1.0 driver revision:",
      "0: uart:16550A port:000003F8 irq:4 tx:0 rx:0",
      "1: uart:unknown port:000002F8 irq:3",
      "2: uart:16550A port:0000E000 irq:17 tx:0 rx:0",
      "",
    ].join("\n");
    expect(parseProcTtyDriverSerial(text)).toEqual(new Set(["ttyS0", "ttyS2"]));
  });

  it("returns an empty set when nothing has a real UART", () => {
    const text = "0: uart:unknown port:000003F8 irq:4\n1: uart:unknown port:000002F8 irq:3\n";
    expect(parseProcTtyDriverSerial(text)).toEqual(new Set());
  });
});

describe("shouldIncludeTtyS", () => {
  it("defers to the real-backed set when /proc/tty/driver/serial was readable", () => {
    const realBacked = new Set(["ttyS0", "ttyS7"]);
    expect(shouldIncludeTtyS("ttyS0", realBacked)).toBe(true);
    expect(shouldIncludeTtyS("ttyS7", realBacked)).toBe(true);
    expect(shouldIncludeTtyS("ttyS1", realBacked)).toBe(false);
  });

  it("falls back to the classic COM1-4 range (ttyS0-3) when the file couldn't be read", () => {
    expect(shouldIncludeTtyS("ttyS0", null)).toBe(true);
    expect(shouldIncludeTtyS("ttyS3", null)).toBe(true);
    expect(shouldIncludeTtyS("ttyS4", null)).toBe(false);
    expect(shouldIncludeTtyS("ttyS31", null)).toBe(false);
  });
});

describe("orderLinuxDeviceNames", () => {
  it("lists USB-attached devices (ttyUSB/ttyACM) before generic ttyS ports", () => {
    const names = ["ttyS1", "ttyUSB0", "ttyS0", "ttyACM0", "ttyUSB1"];
    expect(orderLinuxDeviceNames(names)).toEqual(["ttyACM0", "ttyUSB0", "ttyUSB1", "ttyS0", "ttyS1"]);
  });

  it("natural-sorts within each group", () => {
    const names = ["ttyUSB10", "ttyUSB2", "ttyS10", "ttyS2"];
    expect(orderLinuxDeviceNames(names)).toEqual(["ttyUSB2", "ttyUSB10", "ttyS2", "ttyS10"]);
  });
});

describe("naturalSortByTrailingNumber", () => {
  it("sorts by trailing number, not string order", () => {
    expect(["ttyUSB10", "ttyUSB2", "ttyUSB1"].sort(naturalSortByTrailingNumber)).toEqual([
      "ttyUSB1",
      "ttyUSB2",
      "ttyUSB10",
    ]);
    expect(["COM10", "COM3", "COM1"].sort(naturalSortByTrailingNumber)).toEqual(["COM1", "COM3", "COM10"]);
  });
});
