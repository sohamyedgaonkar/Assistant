// Mocked Grocery Catalog for Blinkit
const GROCERIES = [
  { id: 'G-MILK', name: 'Amul Taaza Toned Fresh Milk', volume: '500 ml', price: 27, time: '8 mins' },
  { id: 'G-BREAD', name: 'Harvest Gold White Bread', volume: '400 g', price: 40, time: '8 mins' },
  { id: 'G-EGGS', name: 'Farm Fresh White Eggs', volume: '6 pcs', price: 45, time: '10 mins' },
  { id: 'G-MAGGI', name: 'Maggi 2-Minute Noodles', volume: '280 g', price: 56, time: '9 mins' },
  { id: 'G-CHIPS', name: 'Lay\'s India\'s Magic Masala', volume: '50 g', price: 20, time: '7 mins' },
  { id: 'G-BANANA', name: 'Robusta Bananas', volume: '500 g', price: 35, time: '11 mins' },
];

export function browse_groceries() {
  return { success: true, catalog: GROCERIES };
}

// In-memory grocery cart
let grocery_cart: any[] = [];

export function add_grocery_to_cart(item_id: string, quantity: number = 1) {
  if (quantity < 1) return { success: false, error: 'Quantity must be at least 1' };

  const item = GROCERIES.find((g) => g.id === item_id);
  if (!item) return { success: false, error: `Grocery item '${item_id}' not found` };

  const existing = grocery_cart.find((i) => i.item.id === item_id);
  if (existing) {
    existing.quantity += quantity;
  } else {
    grocery_cart.push({ item, quantity });
  }

  const total = grocery_cart.reduce((sum, i) => sum + (i.item.price * i.quantity), 0);

  return {
    success: true,
    message: `Added ${quantity}x ${item.name} to cart. Cart total: ₹${total}`,
    cart: grocery_cart,
  };
}

// PhonePe logic
const PHONEPE_BASE_URL = 'https://chromepe-relay.chromepe-relay.workers.dev';
const VPA = 'prasad@chromepe'; // Mock VPA to use

export async function place_grocery_order() {
  if (grocery_cart.length === 0) {
    return { success: false, error: 'Grocery cart is empty.' };
  }

  const total = grocery_cart.reduce((sum, i) => sum + (i.item.price * i.quantity), 0);
  const order_id = `BLINK-${Date.now()}`;

  const payload = {
    amount: total,
    vpa: VPA,
    merchantName: 'Blinkit',
    description: `Grocery Delivery ${order_id}`,
  };

  try {
    const response = await fetch(`${PHONEPE_BASE_URL}/payment/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok) {
      grocery_cart = []; // Clear cart on success
      return {
        success: true,
        order_id,
        total,
        status: 'payment_initiated',
        deepLink: data.deepLink,
        statusUrl: data.statusUrl,
        estimated_delivery: '10 mins',
      };
    } else {
      return { success: false, error: `Payment failed (HTTP ${response.status}): ${JSON.stringify(data)}` };
    }
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
