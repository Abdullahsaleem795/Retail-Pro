import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { motion } from 'framer-motion';
import './BarcodeScanner.css';

const SCANNER_ELEMENT_ID = 'retailpro-barcode-reader';

/**
 * Camera barcode scanner for shops without a hardware wedge scanner - most
 * Pakistani kiryana owners run the POS from an Android phone.
 *
 * Note: getUserMedia requires HTTPS (or localhost). On a LAN IP over plain
 * HTTP the browser blocks camera access, which is why the error path below
 * calls that out explicitly rather than just saying "camera failed".
 */
export default function BarcodeScanner({ onDetected, onClose }) {
  const scannerRef = useRef(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false });
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' }, // rear camera
        { fps: 10, qrbox: { width: 260, height: 150 } },
        (decodedText) => {
          // Stop before handing off so the camera light goes out immediately
          scanner
            .stop()
            .catch(() => {})
            .finally(() => onDetected(decodedText));
        },
        () => {
          // Per-frame decode misses are normal while aiming; ignore them
        }
      )
      .then(() => {
        if (!cancelled) setStarting(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setStarting(false);
        if (!window.isSecureContext) {
          setError('Camera needs a secure connection. Open the app over HTTPS or on localhost.');
        } else if (/NotAllowedError|Permission/i.test(err?.message || '')) {
          setError('Camera permission denied. Allow camera access in your browser settings.');
        } else if (/NotFoundError/i.test(err?.message || '')) {
          setError('No camera found on this device.');
        } else {
          setError(`Could not start camera: ${err?.message || 'unknown error'}`);
        }
      });

    return () => {
      cancelled = true;
      const active = scannerRef.current;
      if (active?.isScanning) {
        active.stop().catch(() => {});
      }
    };
  }, [onDetected]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="scanner-card"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
      >
        <div className="modal-title">Scan Barcode</div>

        <div id={SCANNER_ELEMENT_ID} className="scanner-view" />

        {starting && !error && <p className="scanner-hint">Starting camera...</p>}
        {error ? (
          <p className="scanner-error">{error}</p>
        ) : (
          !starting && <p className="scanner-hint">Point the rear camera at the product barcode.</p>
        )}

        <button className="btn-secondary" style={{ marginTop: '1rem' }} onClick={onClose}>
          Cancel
        </button>
      </motion.div>
    </div>
  );
}
