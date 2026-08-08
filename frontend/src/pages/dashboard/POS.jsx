import { useEffect, useRef, useState, useCallback, useMemo, lazy, Suspense } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { listProducts, getProductByBarcode } from '../../api/products';
import { listCustomers } from '../../api/customers';
import { createSale } from '../../api/sales';
import {
  generateClientRef,
  queueSale,
  countQueuedSales,
  flushQueue,
} from '../../utils/offlineQueue';
import { playBeep } from '../../utils/beep';
import { formatPaymentMethod } from '../../utils/format';
import './POS.css';

// The scanner pulls in a camera/decoding library; keep it out of the POS
// entry chunk so the checkout screen stays fast to load on mobile data.
const BarcodeScanner = lazy(() => import('../../components/BarcodeScanner'));

const PAYMENT_METHODS = ['cash', 'card', 'credit', 'jazzcash', 'easypaisa'];

export default function POS() {
  const searchInputRef = useRef(null);
  // Hardware "wedge" scanners (the trigger-gun and dome types) aren't a
  // detectable connection - to the OS they're indistinguishable from a
  // keyboard, they just type the barcode + Enter into whatever field has
  // focus. So instead of a fake "scanner connected" check, the real fix is
  // making sure this field never loses focus after the actions that would
  // otherwise steal it (adding a product, finishing a camera scan, or
  // completing a sale) - the scanner then "just works" with zero clicks.
  const refocusSearch = () => {
    // preventScroll matters here: a focused element that's off-screen makes
    // the browser auto-scroll it into view by default - since this search
    // box sits at the very top of the page, refocusing it after every
    // addToCart() was yanking the owner back to the top of a long product
    // grid on every single tap, regardless of how far down they'd scrolled.
    requestAnimationFrame(() => searchInputRef.current?.focus({ preventScroll: true }));
  };

  const [search, setSearch] = useState('');
  const [allProducts, setAllProducts] = useState([]);
  const [cart, setCart] = useState([]); // { productId, name, unitPrice, quantity, stockQuantity }
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discount, setDiscount] = useState('0');
  const [checkingOut, setCheckingOut] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await listProducts({ limit: 500 });
      setAllProducts(res.data || []);
    } catch {
      toast.error('Failed to load products');
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Instant client-side filtering at 120 FPS
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return allProducts.slice(0, 30);
    const q = search.toLowerCase().trim();
    return allProducts
      .filter((p) => (p.name || '').toLowerCase().includes(q) || (p.barcode || '').includes(q) || (p.sku || '').toLowerCase().includes(q))
      .slice(0, 30);
  }, [allProducts, search]);

  useEffect(() => {
    listCustomers().then((res) => setCustomers(res.data)).catch(() => {});
  }, []);

  const syncPendingSales = useCallback(async () => {
    const queued = await countQueuedSales().catch(() => 0);
    if (queued === 0) {
      setPendingCount(0);
      return;
    }

    setSyncing(true);
    try {
      const { synced, failed, conflicts } = await flushQueue(createSale);

      if (synced > 0) {
        toast.success(`${synced} offline ${synced === 1 ? 'sale' : 'sales'} synced`);
        fetchProducts();
      }
      conflicts.forEach((c) => {
        // Long duration: this needs the shopkeeper's attention, not a glance
        toast.error(`Offline sale (Rs ${c.total ?? '—'}) could not be saved: ${c.reason}`, { duration: 10000 });
      });

      setPendingCount(failed);
    } catch {
      // Leave the queue intact; the next reconnect or interval will retry
    } finally {
      setSyncing(false);
    }
  }, [fetchProducts]);

  // Sync on mount, whenever the browser reports a reconnect, and on a slow
  // interval as a safety net (navigator.onLine can be wrong on captive wifi).
  useEffect(() => {
    countQueuedSales().then(setPendingCount).catch(() => {});

    const handleOnline = () => {
      setIsOnline(true);
      syncPendingSales();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (navigator.onLine) syncPendingSales();

    const interval = setInterval(() => {
      if (navigator.onLine) syncPendingSales();
    }, 60000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [syncPendingSales]);

  const addToCart = (product) => {
    if (!product || product.stockQuantity <= 0) {
      toast.error('Item is out of stock');
      return;
    }
    refocusSearch();

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === product._id);
      if (existingIndex > -1) {
        const current = prev[existingIndex];
        if (current.quantity >= product.stockQuantity) {
          toast.error(`Only ${product.stockQuantity} in stock`);
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex] = { ...current, quantity: current.quantity + 1 };
        return updated;
      }
      return [
        ...prev,
        {
          productId: product._id,
          name: product.name,
          unitPrice: product.sellingPrice,
          quantity: 1,
          stockQuantity: product.stockQuantity,
        },
      ];
    });
  };

  const handleBarcodeEnter = async (e) => {
    if (e.key !== 'Enter' || !search.trim()) return;
    const term = search.trim();
    // 1. Try local memory first (0ms latency!)
    const localMatch = allProducts.find((p) => p.barcode === term || p.sku === term);
    if (localMatch) {
      addToCart(localMatch);
      playBeep();
      setSearch('');
      return;
    }
    // 2. Server fallback if not in initial 500 items
    try {
      const res = await getProductByBarcode(term);
      addToCart(res.data);
      playBeep();
      setSearch('');
    } catch {
      toast.error(`No product matches barcode "${term}"`);
    }
  };

  const handleScanned = useCallback(async (barcode) => {
    setScannerOpen(false);
    refocusSearch();
    // 1. Try local memory first (0ms latency!)
    const localMatch = allProducts.find((p) => p.barcode === barcode || p.sku === barcode);
    if (localMatch) {
      addToCart(localMatch);
      playBeep();
      toast.success(`Added ${localMatch.name}`);
      return;
    }
    // 2. Server fallback
    try {
      const res = await getProductByBarcode(barcode);
      addToCart(res.data);
      playBeep();
      toast.success(`Added ${res.data.name}`);
    } catch {
      toast.error(`No product found for barcode ${barcode}`);
    }
  }, [allProducts]);

  const updateQuantity = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId !== productId) return item;
          const nextQty = item.quantity + delta;
          if (nextQty > item.stockQuantity) {
            toast.error(`Only ${item.stockQuantity} in stock`);
            return item;
          }
          return { ...item, quantity: nextQty };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId) => setCart((prev) => prev.filter((item) => item.productId !== productId));

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0), [cart]);
  const discountValue = useMemo(() => Math.min(Math.max(Number(discount) || 0, 0), subtotal), [discount, subtotal]);
  const total = Math.max(subtotal - discountValue, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    if (paymentMethod === 'credit' && !customerId) {
      toast.error('Select a customer for credit sales');
      return;
    }
    setCheckingOut(true);

    const clientRef = generateClientRef();
    const payload = {
      items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      customerId: customerId || undefined,
      discount: discountValue,
      paymentMethod,
      amountPaid: total,
    };

    const clearCart = () => {
      setCart([]);
      setDiscount('0');
      setCustomerId('');
      refocusSearch();
    };

    try {
      await createSale({ ...payload, clientRef });
      toast.success('Sale completed');
      clearCart();
      fetchProducts();
    } catch (err) {
      // No response at all means the request never reached the server (offline
      // or dead connection) - safe to queue. A 4xx/5xx means the server did
      // respond and rejected it, so queuing would just replay a bad sale.
      const isNetworkFailure = !err.response;

      if (isNetworkFailure) {
        try {
          await queueSale({
            clientRef,
            queuedAt: new Date().toISOString(),
            payload: { ...payload, displayTotal: total },
          });
          setPendingCount((c) => c + 1);
          toast.success(`Saved offline — will sync when back online (Rs ${total})`, { icon: '📥' });
          clearCart();
        } catch {
          toast.error('Offline and could not save the sale locally. Please write it down.');
        }
      } else {
        toast.error(err.response?.data?.message || 'Checkout failed');
      }
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="pos-shell">
      <div className="pos-catalog">
        <div className="pos-search-row">
          <input
            ref={searchInputRef}
            className="search-input"
            style={{ maxWidth: '100%', marginBottom: 0 }}
            placeholder="Search or scan barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleBarcodeEnter}
            autoFocus
          />
          <button className="pos-scan-btn" onClick={() => setScannerOpen(true)} title="Scan with camera">
            Scan
          </button>
        </div>
        <p className="pos-scanner-hint">
          Have a USB/Bluetooth barcode scanner? Just scan - it types straight into the box above.
          No scanner? Tap Scan to use your camera instead.
        </p>
        <div className="pos-product-grid">
          {filteredProducts.map((p) => (
            <button
              key={p._id}
              className="pos-product-card"
              onClick={() => addToCart(p)}
              disabled={p.stockQuantity <= 0}
            >
              <span className="pos-product-name">{p.name}</span>
              <span className="pos-product-price">Rs {p.sellingPrice}</span>
              <span className={p.stockQuantity <= p.lowStockThreshold ? 'badge badge-warning' : 'badge badge-ok'}>
                {p.stockQuantity} {p.unit}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="pos-cart">
        <h2 className="pos-cart-title">Cart</h2>

        {(!isOnline || pendingCount > 0) && (
          <div className={isOnline ? 'pos-status pos-status-pending' : 'pos-status pos-status-offline'}>
            {!isOnline && <strong>Offline mode.</strong>} {!isOnline && 'Sales are saved on this device.'}
            {pendingCount > 0 && (
              <span>
                {' '}
                {pendingCount} {pendingCount === 1 ? 'sale' : 'sales'} waiting to sync
                {syncing ? ' (syncing...)' : ''}.
              </span>
            )}
            {isOnline && pendingCount > 0 && !syncing && (
              <button className="btn-link" onClick={syncPendingSales} style={{ marginLeft: 6 }}>
                Retry now
              </button>
            )}
          </div>
        )}

        <div className="pos-cart-items">
          {cart.length === 0 && <p className="empty-hint">No items yet. Tap a product to add it.</p>}
          {/* Deliberately no AnimatePresence/exit animation here. Exiting rows were
              being orphaned in the DOM at their initial opacity:0 state, so every
              completed sale left invisible rows occupying layout height in the cart.
              Removal is instant instead, which is also the better feel at a POS
              counter - the cashier gets immediate confirmation the sale went through. */}
          {cart.map((item) => (
            <motion.div
              key={item.productId}
              className="pos-cart-item"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="pos-cart-item-info">
                <span title={item.name}>{item.name}</span>
                <span className="pos-cart-item-price">Rs {item.unitPrice} each</span>
              </div>
              <div className="pos-qty-control">
                <button onClick={() => updateQuantity(item.productId, -1)}>-</button>
                <span>{item.quantity}</span>
                <button onClick={() => updateQuantity(item.productId, 1)}>+</button>
              </div>
              <span className="pos-cart-item-total">Rs {item.unitPrice * item.quantity}</span>
              <button className="pos-remove-btn" onClick={() => removeFromCart(item.productId)}>
                &times;
              </button>
            </motion.div>
          ))}
        </div>

        <div className="pos-cart-footer">
          <div className="form-field">
            <label>Customer (optional)</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Walk-in customer</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Payment Method</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {formatPaymentMethod(m)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Discount (Rs)</label>
              <input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
          </div>

          <div className="pos-totals">
            <div><span>Subtotal</span><span>Rs {subtotal}</span></div>
            <div><span>Discount</span><span>- Rs {discountValue}</span></div>
            <div className="pos-total-grand"><span>Total</span><span>Rs {total}</span></div>
          </div>

          <button className="pos-checkout-btn" onClick={handleCheckout} disabled={checkingOut || cart.length === 0}>
            {checkingOut ? 'Processing...' : `Charge Rs ${total}`}
          </button>
        </div>
      </div>

      {scannerOpen && (
        <Suspense fallback={null}>
          <BarcodeScanner
            onDetected={handleScanned}
            onClose={() => {
              setScannerOpen(false);
              refocusSearch();
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
