// Mocked Bus Catalog
const BUSES = [
  { id: 'B-MUM-GOA-1', operator: 'Neeta Travels', type: 'Volvo AC Sleeper', route: 'Mumbai -> Goa', departure: '21:00', arrival: '08:00', price: 1500, rating: 4.2 },
  { id: 'B-MUM-GOA-2', operator: 'VRL Travels', type: 'Scania AC Semi-Sleeper', route: 'Mumbai -> Goa', departure: '22:30', arrival: '09:30', price: 1200, rating: 4.5 },
  { id: 'B-DEL-JAI-1', operator: 'RSRTC', type: 'AC Seater', route: 'Delhi -> Jaipur', departure: '06:00', arrival: '11:00', price: 600, rating: 4.0 },
  { id: 'B-DEL-JAI-2', operator: 'Zingbus', type: 'Premium AC Sleeper', route: 'Delhi -> Jaipur', departure: '23:30', arrival: '05:00', price: 900, rating: 4.6 },
  { id: 'B-PUN-MUM-1', operator: 'Shivneri (MSRTC)', type: 'Volvo AC Seater', route: 'Pune -> Mumbai', departure: '08:00', arrival: '11:30', price: 550, rating: 4.7 },
];

export function search_buses() {
  return { success: true, buses: BUSES };
}

// In-memory bus cart
let bus_cart: any = null;

export function select_bus(bus_id: string, seats: number = 1) {
  if (seats < 1) return { success: false, error: 'Seats must be at least 1' };

  const bus = BUSES.find((b) => b.id === bus_id);
  if (!bus) return { success: false, error: `Bus '${bus_id}' not found` };

  bus_cart = {
    bus,
    seats,
    totalPrice: bus.price * seats,
  };

  return {
    success: true,
    message: `Selected ${seats} seat(s) on ${bus.operator} (${bus.route}). Total: ₹${bus_cart.totalPrice}`,
  };
}

// PhonePe logic
const PHONEPE_BASE_URL = 'https://chromepe-relay.chromepe-relay.workers.dev';
const VPA = 'prasad@chromepe'; // Mock VPA to use

export async function book_bus() {
  if (!bus_cart) {
    return { success: false, error: 'No bus selected. Search and select a bus before booking.' };
  }

  const total = bus_cart.totalPrice;
  const booking_id = `BUS-${Date.now()}`;

  const payload = {
    amount: total,
    vpa: VPA,
    merchantName: 'RedBus',
    description: `Bus Booking ${booking_id}`,
  };

  try {
    const response = await fetch(`${PHONEPE_BASE_URL}/payment/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok) {
      // Clear bus cart on successful initiation
      bus_cart = null;
      return {
        success: true,
        booking_id,
        total,
        status: 'payment_initiated',
        deepLink: data.deepLink,
        statusUrl: data.statusUrl,
      };
    } else {
      return { success: false, error: `Payment failed (HTTP ${response.status}): ${JSON.stringify(data)}` };
    }
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
