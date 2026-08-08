import { useState } from 'react';
import toast from 'react-hot-toast';
import useThermalPrinter, { isBluetoothSupported } from '../utils/useThermalPrinter';
import { buildReceiptBytes } from '../utils/escpos';

// Sits next to the existing "Download PDF" button as an alternative, not a
// replacement - PDF works everywhere; this only works in Chrome/Edge
// (desktop or Android) with a paired ESC/POS Bluetooth printer, and has not
// been tested against real hardware (see useThermalPrinter.js).
export default function ThermalPrintButton({ sale, shop }) {
  const { connect, print, connected, printing, deviceName, supported } = useThermalPrinter();
  const [paperWidth, setPaperWidth] = useState('58');

  if (!supported) {
    return (
      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }} title="Web Bluetooth needs Chrome or Edge (desktop/Android) - not available in this browser">
        Bluetooth printing unavailable in this browser
      </span>
    );
  }

  const handlePrint = async () => {
    try {
      if (!connected) {
        await connect();
      }
      const columns = paperWidth === '80' ? 48 : 32;
      const bytes = buildReceiptBytes(sale, shop, { columns });
      await print(bytes);
      toast.success('Sent to printer');
    } catch (err) {
      toast.error(err.message || 'Bluetooth print failed');
    }
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <select
        value={paperWidth}
        onChange={(e) => setPaperWidth(e.target.value)}
        style={{ width: 'auto', minWidth: 90 }}
        title="Paper width"
      >
        <option value="58">58mm</option>
        <option value="80">80mm</option>
      </select>
      <button type="button" className="btn-secondary" onClick={handlePrint} disabled={printing}>
        {printing ? 'Printing...' : connected ? `Print (${deviceName})` : 'Print via Bluetooth'}
      </button>
    </div>
  );
}
