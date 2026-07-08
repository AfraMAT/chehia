/**
 * Thermal printer transport over WebUSB (Chrome/Edge on Android + desktop; not
 * iOS Safari — see the POS strategy). Sends raw ESC/POS bytes to a printer-class
 * USB device. The caller falls back to the browser print dialog when this can't
 * run (no WebUSB, no device, or the user cancels the chooser).
 *
 * NOTE: requires a real printer to verify end-to-end (drawer kick + cut). Built
 * to the WebUSB spec; field-test on the certified SKU.
 */

export type PrintResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "no_device" | "error"; message?: string };

// Minimal WebUSB shapes (not in lib.dom) — only what we use.
interface USBEndpoint { endpointNumber: number; direction: "in" | "out" }
interface USBAlternateInterface { interfaceClass: number; endpoints: USBEndpoint[] }
interface USBInterface { interfaceNumber: number; alternate?: USBAlternateInterface; alternates: USBAlternateInterface[] }
interface USBConfiguration { interfaces: USBInterface[] }
interface USBDevice {
  configuration?: USBConfiguration;
  open(): Promise<void>;
  selectConfiguration(n: number): Promise<void>;
  claimInterface(n: number): Promise<void>;
  transferOut(endpoint: number, data: Uint8Array): Promise<unknown>;
  close(): Promise<void>;
}
interface USBLike {
  getDevices(): Promise<USBDevice[]>;
  requestDevice(opts: { filters: { classCode?: number }[] }): Promise<USBDevice>;
}

const PRINTER_CLASS = 7; // USB printer class

function getUsb(): USBLike | null {
  return (navigator as unknown as { usb?: USBLike }).usb ?? null;
}

export function isThermalSupported(): boolean {
  return getUsb() !== null;
}

export async function printBytes(bytes: Uint8Array, opts: { forcePick?: boolean } = {}): Promise<PrintResult> {
  const usb = getUsb();
  if (!usb) return { ok: false, reason: "unsupported" };

  try {
    let device: USBDevice | undefined;
    if (!opts.forcePick) {
      device = (await usb.getDevices())[0];
    }
    if (!device) {
      device = await usb.requestDevice({ filters: [{ classCode: PRINTER_CLASS }] });
    }

    await device.open();
    if (!device.configuration) await device.selectConfiguration(1);
    const config = device.configuration;
    if (!config) return { ok: false, reason: "error", message: "no configuration" };

    const iface =
      config.interfaces.find((i) => (i.alternate ?? i.alternates[0])?.interfaceClass === PRINTER_CLASS) ??
      config.interfaces[0];
    if (!iface) return { ok: false, reason: "error", message: "no interface" };

    await device.claimInterface(iface.interfaceNumber);
    const alt = iface.alternate ?? iface.alternates[0];
    const endpoint = alt?.endpoints.find((e) => e.direction === "out");
    if (!endpoint) return { ok: false, reason: "error", message: "no OUT endpoint" };

    await device.transferOut(endpoint.endpointNumber, bytes);
    await device.close().catch(() => {});
    return { ok: true };
  } catch (e) {
    const err = e as Error;
    if (err.name === "NotFoundError") return { ok: false, reason: "no_device" };
    return { ok: false, reason: "error", message: err.message };
  }
}
