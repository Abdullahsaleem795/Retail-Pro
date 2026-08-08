import { useState } from 'react';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { bulkImportProducts } from '../api/products';
import '../pages/dashboard/Inventory.css';
import './BulkImportModal.css';

const TEMPLATE_HEADERS = [
  'Name', 'SKU', 'Barcode', 'Category', 'Unit', 'Cost Price', 'Selling Price',
  'Stock Quantity', 'Low Stock Alert', 'Expiry Date', 'Expiry Alert Days',
];
const TEMPLATE_EXAMPLE_ROW = [
  'Lux Soft Rose Soap 140g', 'LUX-ROS-140', '896400050505', 'Household', 'pcs',
  '120', '145', '80', '10', '', '',
];

// Maps the spreadsheet's human-friendly column headers onto the same field
// names createProduct/updateProduct already use, so the bulk-import endpoint
// never needs a separate contract to drift out of sync with the single-add
// form. Matched case/spacing-insensitively since a shop owner's own CSV
// won't always spell a header exactly like the template.
const HEADER_MAP = {
  name: 'name',
  sku: 'sku',
  barcode: 'barcode',
  category: 'categoryName',
  unit: 'unit',
  'cost price': 'costPrice',
  'cost price (rs)': 'costPrice',
  'selling price': 'sellingPrice',
  'selling price (rs)': 'sellingPrice',
  'stock quantity': 'stockQuantity',
  'low stock alert': 'lowStockThreshold',
  'low stock threshold': 'lowStockThreshold',
  'expiry date': 'expiryDate',
  'expiry alert days': 'expiryAlertDays',
  'expiry alert (days before)': 'expiryAlertDays',
};

const downloadTemplate = () => {
  const csv = [TEMPLATE_HEADERS, TEMPLATE_EXAMPLE_ROW]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'retailpro-product-import-template.csv';
  link.click();
  URL.revokeObjectURL(url);
};

const mapCsvRow = (rawRow) => {
  const mapped = {};
  Object.entries(rawRow).forEach(([key, value]) => {
    const field = HEADER_MAP[key.trim().toLowerCase()];
    if (field) mapped[field] = typeof value === 'string' ? value.trim() : value;
  });
  return mapped;
};

export default function BulkImportModal({ onClose, onImported }) {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setParseError('');
    setRows([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (res.errors.length > 0) {
          setParseError(res.errors[0].message);
          return;
        }
        const mapped = res.data.map(mapCsvRow).filter((r) => Object.keys(r).length > 0);
        if (mapped.length === 0) {
          setParseError(
            "No product rows found - make sure the file has a header row (Name, SKU, Cost Price, etc.) and at least one product below it."
          );
          return;
        }
        setRows(mapped);
      },
      error: (err) => setParseError(err.message),
    });
    // Allow re-selecting the same filename after fixing it, without the
    // browser silently no-oping because the <input> value didn't change.
    e.target.value = '';
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await bulkImportProducts(rows);
      setResult(res);
      if (res.summary.created + res.summary.updated > 0) {
        toast.success(`${res.summary.created} added, ${res.summary.updated} updated`);
        onImported();
      }
      if (res.summary.failed > 0) {
        toast.error(`${res.summary.failed} row(s) failed - see details below`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="modal-card bulk-import-card"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
      >
        <div className="modal-title">Import Products</div>

        <p className="bulk-import-hint">
          Upload a CSV file to add or update many products at once. Rows are matched by SKU - importing
          a SKU that already exists updates that product instead of creating a duplicate.
        </p>

        <button type="button" className="btn-link" onClick={downloadTemplate}>
          Download CSV Template
        </button>

        <label className="bulk-import-file-field">
          <span>Choose CSV file</span>
          <input type="file" accept=".csv" onChange={handleFileChange} />
        </label>

        {parseError && <p className="scanner-error">{parseError}</p>}

        {rows.length > 0 && (
          <p className="bulk-import-hint">
            Found <strong>{rows.length}</strong> product row{rows.length === 1 ? '' : 's'} in {fileName}.
          </p>
        )}

        {result && (
          <div className="bulk-import-result">
            <p className="bulk-import-hint">
              <strong>{result.summary.created}</strong> added, <strong>{result.summary.updated}</strong> updated,{' '}
              <strong className={result.summary.failed > 0 ? 'bulk-import-failed-count' : ''}>
                {result.summary.failed}
              </strong>{' '}
              failed.
            </p>
            {result.errors.length > 0 && (
              <div className="table-wrap bulk-import-error-table">
                <table className="data-table">
                  <thead>
                    <tr><th>Row</th><th>SKU</th><th>Problem</th></tr>
                  </thead>
                  <tbody>
                    {result.errors.map((err) => (
                      <tr key={err.row}>
                        <td>{err.row}</td>
                        <td>{err.sku}</td>
                        <td>{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {result ? 'Close' : 'Cancel'}
          </button>
          {rows.length > 0 && (
            <button
              type="button"
              className="btn-primary"
              style={{ flex: 1, marginTop: 0 }}
              onClick={handleImport}
              disabled={importing}
            >
              {importing
                ? 'Importing...'
                : result
                  ? 'Import Again'
                  : `Import ${rows.length} Product${rows.length === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
