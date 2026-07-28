import { useState } from 'react';
import { motion } from 'framer-motion';
import '../pages/dashboard/Inventory.css';

export default function ConfirmModal({
  title = 'Are you sure?',
  message,
  confirmText = 'Delete',
  confirmVariant = 'danger',
  onConfirm,
  onClose,
}) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
      >
        <div className="modal-title">{title}</div>
        <p style={{ marginTop: '0.75rem', marginBottom: '1.5rem', color: '#4b5563', fontSize: '0.95rem' }}>
          {message}
        </p>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{
              flex: 1,
              marginTop: 0,
              backgroundColor: confirmVariant === 'danger' ? '#dc2626' : undefined,
              borderColor: confirmVariant === 'danger' ? '#dc2626' : undefined,
            }}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
