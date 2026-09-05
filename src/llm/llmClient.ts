import { OPENROUTER_API_KEY, LLM_MODEL } from '../config';
import { browse_menu, add_to_cart, view_cart, place_order } from '../tools/foodTools';
import { search_hotels, select_hotel, book_trip } from '../tools/travelTools';
import { search_buses, select_bus, book_bus } from '../tools/busTools';
import { browse_groceries, add_grocery_to_cart, place_grocery_order } from '../tools/groceryTools';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content?: string;
  name?: string; // used for tool role
  tool_calls?: any[];
  tool_call_id?: string;
}

const tools = [
  {
    type: 'function',
    function: {
      name: 'browse_menu',
      description: 'ZOMATO ONLY: Browse the restaurant food menu. Optionally filter by category.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'The category to filter by (Starters, Main Course, Beverages)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_to_cart',
      description: 'ZOMATO ONLY: Add a restaurant food menu item to the Zomato cart by its ID (e.g. S1, M2, B3). DO NOT use this for groceries.',
      parameters: {
        type: 'object',
        properties: {
          item_id: { type: 'string', description: 'The ID of the item to add (e.g. S1, M1)' },
          quantity: { type: 'integer', description: 'The quantity to add' },
        },
        required: ['item_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'view_cart',
      description: 'ZOMATO ONLY: View the current Zomato food cart contents and total.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'place_order',
      description: 'ZOMATO ONLY: Place the restaurant food order. DO NOT use this for groceries.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_hotels',
      description: 'Search for all available hotels. Optionally filter by city.',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'The city to search hotels in (e.g. Mumbai, Goa, Delhi)' }
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'select_hotel',
      description: 'Select a hotel to add to the trip cart.',
      parameters: {
        type: 'object',
        properties: {
          hotel_id: { type: 'string' },
          nights: { type: 'integer' },
        },
        required: ['hotel_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_trip',
      description: 'Book the selected hotel. Processes payment via PhonePe.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_buses',
      description: 'Search for all available buses between cities.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'select_bus',
      description: 'Select a bus to add to the bus cart.',
      parameters: {
        type: 'object',
        properties: {
          bus_id: { type: 'string' },
          seats: { type: 'integer' },
        },
        required: ['bus_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_bus',
      description: 'Book the selected bus. Processes payment via PhonePe.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browse_groceries',
      description: 'BLINKIT ONLY: Browse the 10-minute grocery delivery catalog.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_grocery_to_cart',
      description: 'BLINKIT ONLY: Add a grocery item to the Blinkit cart by its ID (e.g. G-MILK). DO NOT use this for restaurant food.',
      parameters: {
        type: 'object',
        properties: {
          item_id: { type: 'string' },
          quantity: { type: 'integer' },
        },
        required: ['item_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'place_grocery_order',
      description: 'BLINKIT ONLY: Place the grocery order for instant delivery. DO NOT use this for restaurant food.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

const SYSTEM_PROMPT = `You are Iqooistant, a helpful AI assistant inside the user's phone.
You have access to specific apps and tools. YOU MUST NOT CONFUSE THEM:
1. Zomato (Food Delivery): Use 'browse_menu', 'add_to_cart', 'view_cart', and 'place_order' ONLY for restaurant food.
2. Blinkit (Groceries): Use 'browse_groceries', 'add_grocery_to_cart', and 'place_grocery_order' ONLY for 10-minute groceries.
3. MakeMyTrip (Travel): Use 'search_hotels', 'select_hotel', 'book_trip' ONLY for hotels.
4. RedBus (Bus): Use 'search_buses', 'select_bus', 'book_bus' ONLY for buses.
All payments go through ChromePe. Be concise and confirm before booking.
DO NOT use <think> or <thought> tags. Skip thinking mode and reply instantly.`;

export async function chatWithLLM(
  messages: ChatMessage[],
  onToolCall: (name: string, args: any) => void,
  useLocalLLM: boolean = false,
  enabledApps: Record<string, boolean> = { zomato: true, makemytrip: true, redbus: true, blinkit: true, chromepe: true }
): Promise<ChatMessage[]> {
  const apiMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages,
  ];

  try {
    const endpoint = useLocalLLM ? 'http://127.0.0.1:8080/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (!useLocalLLM) {
      headers['Authorization'] = `Bearer ${OPENROUTER_API_KEY}`;
    }

    const filteredTools = tools.filter(t => {
      const name = t.function.name;
      if (!enabledApps.chromepe && ['place_order', 'book_trip', 'book_bus', 'place_grocery_order'].includes(name)) return false;
      if (!enabledApps.zomato && ['browse_menu', 'add_to_cart', 'view_cart', 'place_order'].includes(name)) return false;
      if (!enabledApps.makemytrip && ['search_hotels', 'select_hotel', 'book_trip'].includes(name)) return false;
      if (!enabledApps.redbus && ['search_buses', 'select_bus', 'book_bus'].includes(name)) return false;
      if (!enabledApps.blinkit && ['browse_groceries', 'add_grocery_to_cart', 'place_grocery_order'].includes(name)) return false;
      return true;
    });

    const bodyObj: any = {
      model: useLocalLLM ? 'local-model' : LLM_MODEL,
      messages: apiMessages,
    };

    if (filteredTools.length > 0) {
      bodyObj.tools = filteredTools;
      bodyObj.tool_choice = 'auto';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyObj),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API Error:', errorText);
      throw new Error(`OpenRouter API Error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const message = data.choices[0].message;

    // Check if the LLM decided to call a tool
    if (message.tool_calls && message.tool_calls.length > 0) {
      // Append the assistant's tool call message
      const newMessages = [...messages, message];

      // Execute each tool call
      for (const toolCall of message.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments || '{}');

        // Trigger UI callback
        onToolCall(functionName, functionArgs);

        let result: any = null;
        if (functionName === 'browse_menu') {
          result = browse_menu(functionArgs.category);
        } else if (functionName === 'add_to_cart') {
          result = add_to_cart(functionArgs.item_id, functionArgs.quantity || 1);
        } else if (functionName === 'view_cart') {
          result = view_cart();
        } else if (functionName === 'place_order') {
          result = await place_order();
        } else if (functionName === 'search_hotels') {
          result = search_hotels(functionArgs.city);
        } else if (functionName === 'select_hotel') {
          result = select_hotel(functionArgs.hotel_id, functionArgs.nights || 1);
        } else if (functionName === 'book_trip') {
          result = await book_trip();
        } else if (functionName === 'search_buses') {
          result = search_buses();
        } else if (functionName === 'select_bus') {
          result = select_bus(functionArgs.bus_id, functionArgs.seats || 1);
        } else if (functionName === 'book_bus') {
          result = await book_bus();
        } else if (functionName === 'browse_groceries') {
          result = browse_groceries();
        } else if (functionName === 'add_grocery_to_cart') {
          result = add_grocery_to_cart(functionArgs.item_id, functionArgs.quantity || 1);
        } else if (functionName === 'place_grocery_order') {
          result = await place_grocery_order();
        } else {
          result = { error: 'Unknown tool' };
        }

        // Append the tool result message
        newMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: functionName,
          content: JSON.stringify(result),
        });
      }

      // Recursively call the LLM again with the tool results
      return chatWithLLM(newMessages, onToolCall, useLocalLLM);
    } else {
      // It's a standard text response
      return [...messages, message];
    }
  } catch (error) {
    console.error('LLM API Error:', error);
    throw error;
  }
}
