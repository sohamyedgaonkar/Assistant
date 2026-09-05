// Mocked Hotel Catalog
const HOTELS = [
  { id: 'H-MUM-1', city: 'Mumbai', name: 'Taj Mahal Palace', price: 15000, rating: 4.9, image_url: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80' },
  { id: 'H-MUM-2', city: 'Mumbai', name: 'Trident Nariman Point', price: 9500, rating: 4.6, image_url: 'https://images.unsplash.com/photo-1551882547-ff40c0d13c81?auto=format&fit=crop&w=800&q=80' },
  { id: 'H-GOA-1', city: 'Goa', name: 'The Leela Goa', price: 18000, rating: 4.8, image_url: 'https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=800&q=80' },
  { id: 'H-GOA-2', city: 'Goa', name: 'Taj Exotica Resort', price: 21000, rating: 4.9, image_url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=800&q=80' },
  { id: 'H-DEL-1', city: 'Delhi', name: 'The Oberoi', price: 16000, rating: 4.9, image_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80' },
  { id: 'H-DEL-2', city: 'Delhi', name: 'ITC Maurya', price: 12500, rating: 4.7, image_url: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80' },
];

export function search_hotels(city?: string) {
  if (city) {
    const filtered = HOTELS.filter(h => h.city.toLowerCase() === city.toLowerCase());
    if (filtered.length > 0) {
      return { success: true, hotels: filtered };
    }
    return { success: false, error: `No hotels found in ${city}. Available cities: Mumbai, Goa, Delhi` };
  }
  return { success: true, hotels: HOTELS };
}

// In-memory trip cart
let trip_cart: any = null;

export function select_hotel(hotel_id: string, nights: number = 1) {
  if (nights < 1) return { success: false, error: 'Nights must be at least 1' };

  const hotel = HOTELS.find((h) => h.id === hotel_id);
  if (!hotel) return { success: false, error: `Hotel '${hotel_id}' not found` };

  trip_cart = {
    hotel,
    nights,
    totalPrice: hotel.price * nights,
  };

  return {
    success: true,
    message: `Selected ${nights} night(s) at ${hotel.name} (${hotel.city}). Trip total: ₹${trip_cart.totalPrice}`,
  };
}

// PhonePe logic
const PHONEPE_BASE_URL = 'https://chromepe-relay.chromepe-relay.workers.dev';
const VPA = 'prasad@chromepe'; // Mock VPA to use

export async function book_trip() {
  if (!trip_cart) {
    return { success: false, error: 'No hotel selected. Search and select a hotel before booking.' };
  }

  const total = trip_cart.totalPrice;
  const booking_id = `TRIP-${Date.now()}`;

  const payload = {
    amount: total,
    vpa: VPA,
    merchantName: 'MakeMyTrip Hotels',
    description: `Hotel Booking ${booking_id}`,
  };

  try {
    const response = await fetch(`${PHONEPE_BASE_URL}/payment/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok) {
      // Clear trip cart on successful initiation
      trip_cart = null;
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
