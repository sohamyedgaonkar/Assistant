import { OPENROUTER_API_KEY, LLM_MODEL } from '../config';
import { browse_menu, add_to_cart, view_cart, place_order } from '../tools/foodTools';

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
      description: 'Browse the food menu. Optionally filter by category (Starters, Main Course, Beverages).',
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
      description: 'Add a menu item to the cart by its ID (e.g. S1, M2, B3).',
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
      description: 'View the current cart contents and total.',
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
      description: 'Place an order with the current cart items. Processes payment via PhonePe.',
      parameters: {
        type: 'object',
        properties: {
          customer_name: { type: 'string' },
          phone_number: { type: 'string' },
        },
      },
    },
  },
];

const SYSTEM_PROMPT = `You are Iqooistant, a helpful AI food ordering and payment assistant inside the user's phone.
You have access to tools to browse the menu, add items to the cart, view the cart, and place orders via PhonePe.
Be concise, polite, and helpful. When a user asks to order something, browse the menu first if you don't know the ID, then add it to the cart. Always confirm the cart before placing the order.`;

export async function chatWithLLM(
  messages: ChatMessage[],
  onToolCall: (name: string, args: any) => void
): Promise<ChatMessage[]> {
  const apiMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages,
  ];

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: apiMessages,
        tools: tools,
        tool_choice: 'auto',
      }),
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
          result = await place_order(functionArgs.customer_name, functionArgs.phone_number);
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
      return chatWithLLM(newMessages, onToolCall);
    } else {
      // It's a standard text response
      return [...messages, message];
    }
  } catch (error) {
    console.error('LLM API Error:', error);
    throw error;
  }
}
