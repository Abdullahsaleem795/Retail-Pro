import { useCallback, useRef, useState } from 'react';

// Web Bluetooth support: Chrome/Edge on desktop and Android only - NOT
// Safari/iOS (no Web Bluetooth at all) and not Firefox by default. Callers
// should check `supported` and fall back to the existing PDF receipt path
// when false, which is why this never replaces downloadReceipt().
export const isBluetoothSupported = () =>
  typeof navigator !== 'undefined' && 'bluetooth' in navigator;

// Cheap ESC/POS BLE thermal printers (the common 58mm "mini printer" boards
// sold widely in Pakistan) don't share one standard GATT service UUID across
// vendors. Rather than hardcode a single UUID that only works for one model,
// we request broad access and then probe the connected device's own GATT
// tree for the first service exposing a writable characteristic - this is
// what most ESC/POS web-print libraries do in practice, since there is no
// universal profile to target directly.
const CANDIDATE_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // common cheap-printer service
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip/ISSC UART-like, used by many BLE printer boards
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 style UART module, common in DIY/low-cost boards
];

const CHUNK_SIZE = 100; // conservative for default BLE MTU; most stacks negotiate higher but this is safe
const CHUNK_DELAY_MS = 20;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function useThermalPrinter() {
  const [connected, setConnected] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [deviceName, setDeviceName] = useState(null);
  const characteristicRef = useRef(null);
  const deviceRef = useRef(null);

  const connect = useCallback(async () => {
    if (!isBluetoothSupported()) {
      throw new Error('Web Bluetooth is not supported in this browser. Use Chrome/Edge on desktop or Android.');
    }

    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: CANDIDATE_SERVICES,
    });
    deviceRef.current = device;

    device.addEventListener('gattserverdisconnected', () => {
      setConnected(false);
      characteristicRef.current = null;
    });

    const server = await device.gatt.connect();

    let writableCharacteristic = null;
    for (const serviceUuid of CANDIDATE_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        const characteristics = await service.getCharacteristics();
        writableCharacteristic = characteristics.find(
          (c) => c.properties.write || c.properties.writeWithoutResponse
        );
        if (writableCharacteristic) break;
      } catch {
        // This device doesn't expose that service - try the next candidate.
      }
    }

    if (!writableCharacteristic) {
      throw new Error(
        `Connected to "${device.name || 'device'}" but couldn't find a printable (writable) Bluetooth characteristic. This printer model may need a different service UUID - see CANDIDATE_SERVICES in useThermalPrinter.js.`
      );
    }

    characteristicRef.current = writableCharacteristic;
    setDeviceName(device.name || 'Thermal printer');
    setConnected(true);
  }, []);

  const disconnect = useCallback(() => {
    deviceRef.current?.gatt?.disconnect();
    setConnected(false);
    characteristicRef.current = null;
  }, []);

  const print = useCallback(async (bytes) => {
    if (!characteristicRef.current) {
      throw new Error('Not connected to a printer yet.');
    }
    setPrinting(true);
    try {
      const characteristic = characteristicRef.current;
      const canWriteWithoutResponse = characteristic.properties.writeWithoutResponse;
      for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
        const chunk = bytes.slice(offset, offset + CHUNK_SIZE);
        if (canWriteWithoutResponse) {
          await characteristic.writeValueWithoutResponse(chunk);
        } else {
          await characteristic.writeValue(chunk);
        }
        await sleep(CHUNK_DELAY_MS);
      }
    } finally {
      setPrinting(false);
    }
  }, []);

  return { connect, disconnect, print, connected, printing, deviceName, supported: isBluetoothSupported() };
}
