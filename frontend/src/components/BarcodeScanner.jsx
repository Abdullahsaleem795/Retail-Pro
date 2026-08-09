import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import 'barcode-detector';
import './BarcodeScanner.css';

// Retail-relevant 1D formats only - matches what a shop actually sells
// (packaged goods use EAN/UPC; some suppliers still use Code128/39).
const RETAIL_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'codabar'];

// Detection interval - fast enough to feel instant, not so fast it pegs the
// CPU running a WASM decode on every single video frame.
const DETECT_INTERVAL_MS = 200;

export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const [error, setError] = useState('');
  // Serializes camera start/stop across React StrictMode's dev-mode double-
  // invoke (mount -> cleanup -> mount): each new effect instance awaits the
  // PREVIOUS instance's full teardown (camera released) before requesting
  // its own stream, so two camera feeds can never be live/writing into the
  // video element at once - which is what "split screen" symptoms actually
  // are under the hood.
  const teardownChainRef = useRef(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    let stream = null;
    let intervalId = null;
    let resolveTeardown;
    const teardownPromise = new Promise((resolve) => { resolveTeardown = resolve; });

    const previousTeardown = teardownChainRef.current;
    teardownChainRef.current = previousTeardown.then(() => teardownPromise);

    const getCameraStream = async () => {
      try {
        // Prefer the back camera on a phone.
        return await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      } catch {
        // Laptops/desktops often have no "environment" camera at all, which
        // throws OverconstrainedError - fall back to whatever camera exists.
        return navigator.mediaDevices.getUserMedia({ video: true });
      }
    };

    (async () => {
      await previousTeardown;
      if (cancelled) {
        resolveTeardown();
        return;
      }
      try {
        stream = await getCameraStream();
      } catch {
        if (!cancelled) setError('Could not access the camera. Check camera permissions and try again.');
        resolveTeardown();
        return;
      }
      if (cancelled || !videoRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        resolveTeardown();
        return;
      }

      videoRef.current.srcObject = stream;
      try {
        await videoRef.current.play();
      } catch {
        // Autoplay can reject if the tab lost focus mid-start; the video
        // still plays once the element is visible, no need to hard-fail.
      }

      // window.BarcodeDetector is the browser's native, hardware-accelerated
      // implementation when available (Chrome/Edge); the 'barcode-detector'
      // import above only fills it in with a ZXing-WASM fallback when the
      // browser has no native support (Safari/Firefox) - same code path
      // either way, always the best engine actually available.
      const detector = new window.BarcodeDetector({ formats: RETAIL_FORMATS });

      intervalId = setInterval(async () => {
        if (cancelled || !videoRef.current || videoRef.current.readyState < 2) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0 && !cancelled) {
            cancelled = true;
            clearInterval(intervalId);
            stream.getTracks().forEach((t) => t.stop());
            onDetected(codes[0].rawValue);
            resolveTeardown();
          }
        } catch {
          // A single failed frame decode isn't an error worth surfacing -
          // the next interval tick just tries again.
        }
      }, DETECT_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      resolveTeardown();
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

        <div className="scanner-view">
          <video ref={videoRef} className="scanner-video" muted playsInline autoPlay />
          {!error && <div className="scanner-guide" aria-hidden="true" />}
        </div>

        {error && <p className="scanner-error">{error}</p>}

        {!error && (
          <p className="scanner-hint">
            <strong>Tip:</strong> hold the barcode steady inside the frame, and watch out for glare.
          </p>
        )}

        <button className="btn-secondary" style={{ marginTop: '1rem' }} onClick={onClose}>
          Cancel
        </button>
      </motion.div>
    </div>
  );
}
