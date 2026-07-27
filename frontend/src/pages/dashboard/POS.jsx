import { useEffect, useState, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { listProducts, getProductByBarcode } from '../../api/products';
import { listCustomers } from '../../api/customers';
import { createSale } from '../../api/sales';
import './POS.css';

const PAYMENT_METHODS = ['cash', 'card', 'credit', 'jazzcash', 'easypaisa'];

export default function POS() {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]); // { productId, name, unitPrice, quantity, stockQuantity }
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discount, setDiscount] = useState('0');
  const [checkingOut, setCheckingOut] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await listProducts({ search: search || undefined, limit: 30 });
      setProducts(res.data);
    } catch {
      toast.error('Failed to load products');
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchProducts, 250);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  useEffect(() => {
    listCustomers().then((res) => setCustomers(res.data)).catch(() => {});
  }, []);

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product._id);
      if (existing) {
        if (existing.quantity >= product.stockQuantity) {
          toast.error(`Only ${product.stockQuantity} in stock`);
          return prev;
        }
        return prev.map((item) =>
          item.productId === product._id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      if (product.stockQuantity <= 0) {
        toast.error('Out of stock');
        return prev;
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
    try {
      const res = await getProductByBarcode(search.trim());
      addToCart(res.data);
      setSearch('');
    } catch {
      // not a barcode match - leave as free text search
    }
  };

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
  const discountValue = Number(discount) || 0;
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
    try {
      await createSale({
        items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        customerId: customerId || undefined,
        discount: discountValue,
        paymentMethod,
        amountPaid: total,
      });
      toast.success('Sale completed');
      setCart([]);
      setDiscount('0');
      setCustomerId('');
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Checkout failed');
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="pos-shell">
      <div className="pos-catalog">
        <input
          className="search-input"
          style={{ maxWidth: '100%' }}
          placeholder="Search or scan barcode..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleBarcodeEnter}
          autoFocus
        />
        <div className="pos-product-grid">
          {products.map((p) => (
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
                <span>{item.name}</span>
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
                  <option key={m} value={m}>{m}</option>
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

          <button className="btn-primary" onClick={handleCheckout} disabled={checkingOut || cart.length === 0}>
            {checkingOut ? 'Processing...' : `Charge Rs ${total}`}
          </button>
        </div>
      </div>
    </div>
  );
}
