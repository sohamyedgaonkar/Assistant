import React, { useState, useRef, useEffect } from 'react';
import { chatWithLLM, ChatMessage } from './src/llm/llmClient';
import {
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  Linking,
  Image,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

type MessageType = 'user' | 'assistant' | 'tool_zomato' | 'tool_chromepe';

interface Message {
  id: string;
  type: MessageType;
  text?: string;
  toolData?: any;
}

const ZOMATO_LOGO = 'https://b.zmtcdn.com/web_assets/8313a97515fcb0447d2d77c276532a511583262271.png';
const CHROMEPE_LOGO = 'https://img.icons8.com/color/96/phone-pe.png';

// Micro-animation component for Tool Calls
const ToolCallIndicator = ({ type, data }: { type: 'zomato' | 'chromepe', data: any }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  if (type === 'zomato') {
    return (
      <Animated.View style={[styles.toolContainer, { transform: [{ scale: pulseAnim }] }]}>
        <Image source={{ uri: ZOMATO_LOGO }} style={[styles.toolLogo, { backgroundColor: '#e23744', borderRadius: 8 }]} resizeMode="contain" />
        <View style={styles.toolTextContainer}>
          <Text style={styles.toolTitle}>Contacting Zomato...</Text>
          <Text style={styles.toolSubtitle}>{data?.query || 'Searching for food...'}</Text>
        </View>
      </Animated.View>
    );
  }

  if (type === 'chromepe') {
    return (
      <Animated.View style={[styles.toolContainer, styles.chromepeContainer, { transform: [{ scale: pulseAnim }] }]}>
        <Image source={{ uri: CHROMEPE_LOGO }} style={styles.toolLogo} resizeMode="contain" />
        <View style={styles.toolTextContainer}>
          <Text style={styles.toolTitle}>Pending Approval</Text>
          <Text style={styles.toolSubtitle}>Please approve on Chromepe app</Text>
        </View>
        <TouchableOpacity
          style={styles.approveButton}
          onPress={() => {
            // Simulate deep link
            Linking.openURL('chromepe://approve').catch(() => {
              console.log('Deep link failed, but simulated in UI');
            });
          }}>
          <Text style={styles.approveButtonText}>Approve</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return null;
};

export default function App() {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', type: 'assistant', text: 'Hello! I am your Iqooistant. I can help you order food and make payments seamlessly. How can I help you today?' },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  const handleSend = async () => {
    if (!inputText.trim() || isTyping) return;

    const userText = inputText.trim();
    const newUserMsg: Message = { id: Date.now().toString(), type: 'user', text: userText };
    setMessages((prev) => [...prev, newUserMsg]);
    setInputText('');
    setIsTyping(true);

    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', content: userText }];
    setChatHistory(newHistory);

    try {
      const finalHistory = await chatWithLLM(newHistory, (toolName, toolArgs) => {
        // Render UI feedback immediately when a tool is called
        if (toolName === 'place_order') {
          setMessages((prev) => [...prev, {
            id: Date.now().toString(),
            type: 'tool_chromepe',
            toolData: { amount: toolArgs.total || 0 },
          }]);
        } else {
          setMessages((prev) => [...prev, {
            id: Date.now().toString(),
            type: 'tool_zomato',
            toolData: { query: toolName === 'browse_menu' ? 'Browsing menu...' : 'Adding to cart...' },
          }]);
        }
      });

      setChatHistory(finalHistory);
      
      // Extract the final assistant text
      const lastMessage = finalHistory[finalHistory.length - 1];
      if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content) {
        setMessages((prev) => [...prev, {
          id: Date.now().toString(),
          type: 'assistant',
          text: lastMessage.content,
        }]);
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, {
        id: Date.now().toString(),
        type: 'assistant',
        text: 'Sorry, I encountered an error communicating with the brain.',
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const resetChat = () => {
    setMessages([
      { id: Date.now().toString(), type: 'assistant', text: 'Hello! I am your Iqooistant. I can help you order food and make payments seamlessly. How can I help you today?' },
    ]);
    setChatHistory([]);
  };

  const renderItem = ({ item }: { item: Message }) => {
    if (item.type === 'user') {
      return (
        <View style={styles.userMessageBubble}>
          <Text style={styles.userMessageText}>{item.text}</Text>
        </View>
      );
    }
    if (item.type === 'assistant') {
      return (
        <View style={styles.assistantMessageBubble}>
          <Text style={styles.assistantMessageText}>{item.text}</Text>
        </View>
      );
    }
    if (item.type === 'tool_zomato') {
      return (
        <View style={styles.toolWrapper}>
          <ToolCallIndicator type="zomato" data={item.toolData} />
        </View>
      );
    }
    if (item.type === 'tool_chromepe') {
      return (
        <View style={styles.toolWrapper}>
          <ToolCallIndicator type="chromepe" data={item.toolData} />
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.safeArea}>
      {/* @ts-ignore: backgroundColor is a valid Android property */}
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'android' ? 20 : 0}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>IQOOISTANT</Text>
          <TouchableOpacity onPress={resetChat} style={styles.reloadButton}>
            <Text style={styles.reloadIcon}>⟳</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
        />

        <View style={[styles.inputContainer, { paddingBottom: Platform.OS === 'android' ? 40 : 32 }]}>
          <TextInput
            style={styles.input}
            placeholder="Message Iqooistant..."
            placeholderTextColor="#8e8e93"
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f7', // Premium light background
  },
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 16 : 48,
    paddingBottom: 22,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#1a1a1c',
  },
  reloadButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f5',
  },
  reloadIcon: {
    fontSize: 18,
    color: '#8e8e93',
    fontWeight: '600',
  },
  messageList: {
    padding: 16,
    paddingBottom: 32,
  },
  userMessageBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#0a84ff',
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderBottomRightRadius: 4,
    maxWidth: '80%',
    marginBottom: 16,
    shadowColor: '#0a84ff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  userMessageText: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 22,
  },
  assistantMessageBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    marginBottom: 16,
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  assistantMessageText: {
    color: '#1c1c1e',
    fontSize: 16,
    lineHeight: 22,
  },
  toolWrapper: {
    alignSelf: 'center',
    width: '100%',
    marginBottom: 16,
    alignItems: 'center',
  },
  toolContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e5ea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    width: '90%',
  },
  chromepeContainer: {
    borderColor: 'rgba(94, 45, 145, 0.2)',
    backgroundColor: '#faf8fc',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  toolLogo: {
    width: 40,
    height: 40,
    marginRight: 12,
    borderRadius: 8,
  },
  toolTextContainer: {
    flex: 1,
  },
  toolTitle: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  toolSubtitle: {
    color: '#8e8e93',
    fontSize: 13,
  },
  approveButton: {
    marginTop: 12,
    backgroundColor: '#5f259f',
    width: '100%',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  approveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e5ea',
  },
  input: {
    flex: 1,
    backgroundColor: '#f2f2f7',
    color: '#000000',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#0a84ff',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sendButtonDisabled: {
    backgroundColor: '#3a3a3c',
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
