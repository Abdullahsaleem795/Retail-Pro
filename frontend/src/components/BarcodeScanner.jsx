import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { motion } from 'framer-motion';
import './BarcodeScanner.css';

export default function BarcodeScanner({ onDetected, onClose }) {
  const [error, setError] = useState('');
  const scannerRef = useRef(null);
  const mountLock = useRef(false);

  useEffect(() => {
    // Prevent React 18 StrictMode double-mounting from creating multiple video elements
    if (mountLock.current) return;
    mountLock.current = true;

    let isUnmounted = false;
    
    // Force clear any leftover DOM elements from hot-reloads
    const readerDiv = document.getElementById("reader");
    if (readerDiv) readerDiv.innerHTML = "";

    const html5QrCode = new Html5Qrcode("reader");
    scannerRef.current = html5QrCode;

    html5QrCode.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 300, height: 150 }
      },
      (decodedText) => {
        if (!isUnmounted) {
          isUnmounted = true;
          if (scannerRef.current && scannerRef.current.isScanning) {
            scannerRef.current.stop().then(() => {
              onDetected(decodedText);
            }).catch(() => {
              onDetected(decodedText);
            });
          } else {
             onDetected(decodedText);
          }
        }
      },
      () => { /* Ignore empty frames */ }
    ).catch(err => {
      if (!isUnmounted) setError("Failed to start camera: " + err);
    });

    return () => {
      isUnmounted = true;
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().then(() => {
          scannerRef.current.clear();
        }).catch(e => console.error(e));
      }
      mountLock.current = false;
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

        <div className="scanner-view" style={{ overflow: 'hidden', borderRadius: '8px', minHeight: '200px' }}>
          <div id="reader" style={{ width: '100%' }}></div>
        </div>

        {error && <p className="scanner-error">{error}</p>}
        
        {!error && (
          <p className="scanner-hint" style={{ marginTop: '15px' }}>
            <strong>Important:</strong> Watch out for screen glare! Ensure the barcode lines are not covered by white light reflection.
          </p>
        )}

        <button className="btn-secondary" style={{ marginTop: '1rem' }} onClick={onClose}>
          Cancel
        </button>
      </motion.div>
    </div>
  );
}
