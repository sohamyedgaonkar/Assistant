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
  PermissionsAndroid,
  NativeModules,
  NativeEventEmitter,
  ScrollView,
  Modal,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const { CustomSpeech } = NativeModules;
const speechEmitter = new NativeEventEmitter(CustomSpeech);

console.log("==== NATIVE MODULES WITH VOICE ====", Object.keys(NativeModules).filter(k => k.toLowerCase().includes('voice')));


type MessageType = 'user' | 'assistant' | 'tool_zomato' | 'tool_chromepe' | 'tool_makemytrip' | 'tool_makemytrip_hotels' | 'tool_redbus' | 'tool_redbus_buses' | 'tool_blinkit';

interface Message {
  id: string;
  type: MessageType;
  text?: string;
  toolData?: any;
}

const ZOMATO_LOGO = require('./assets/zomato_logo.png');
const CHROMEPE_LOGO = require('./assets/chromepe_logo.png');
const MAKEMYTRIP_LOGO = require('./assets/makemytrip_logo.png');
const REDBUS_LOGO = require('./assets/redbus_logo.png');
const BLINKIT_LOGO = require('./assets/blinkit_logo.png');

// Micro-animation component for Tool Calls
const ToolCallIndicator = ({ type, data }: { type: 'zomato' | 'chromepe' | 'makemytrip' | 'redbus' | 'blinkit', data?: any }) => {
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
        <Image source={ZOMATO_LOGO} style={[styles.toolLogo, { backgroundColor: '#e23744', borderRadius: 8 }]} resizeMode="contain" />
        <View style={styles.toolTextContainer}>
          <Text style={styles.toolTitle}>Zomato</Text>
          <Text style={styles.toolSubtitle}>{data?.query || 'Connecting to Zomato...'}</Text>
        </View>
      </Animated.View>
    );
  }

  if (type === 'chromepe') {
    return (
      <Animated.View style={[styles.toolContainer, styles.chromepeContainer, { transform: [{ scale: pulseAnim }] }]}>
        <Image source={CHROMEPE_LOGO} style={styles.toolLogo} resizeMode="contain" />
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

  if (type === 'makemytrip') {
    return (
      <Animated.View style={[styles.toolContainer, { transform: [{ scale: pulseAnim }] }]}>
        <Image source={MAKEMYTRIP_LOGO} style={[styles.toolLogo, { backgroundColor: '#d83e28', borderRadius: 8 }]} resizeMode="contain" />
        <View style={styles.toolTextContainer}>
          <Text style={styles.toolTitle}>MakeMyTrip</Text>
          <Text style={styles.toolSubtitle}>{data?.query || 'Connecting to MMT...'}</Text>
        </View>
      </Animated.View>
    );
  }

  if (type === 'redbus') {
    return (
      <Animated.View style={[styles.toolContainer, { transform: [{ scale: pulseAnim }] }]}>
        <Image source={REDBUS_LOGO} style={[styles.toolLogo, { backgroundColor: '#d84e55', borderRadius: 8 }]} resizeMode="contain" />
        <View style={styles.toolTextContainer}>
          <Text style={styles.toolTitle}>RedBus</Text>
          <Text style={styles.toolSubtitle}>{data?.query || 'Connecting to RedBus...'}</Text>
        </View>
      </Animated.View>
    );
  }

  if (type === 'blinkit') {
    return (
      <Animated.View style={[styles.toolContainer, { transform: [{ scale: pulseAnim }] }]}>
        <Image source={BLINKIT_LOGO} style={[styles.toolLogo, { backgroundColor: '#f2cf3f', borderRadius: 8 }]} resizeMode="contain" />
        <View style={styles.toolTextContainer}>
          <Text style={styles.toolTitle}>Blinkit</Text>
          <Text style={styles.toolSubtitle}>{data?.query || 'Connecting to Blinkit...'}</Text>
        </View>
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
  const [useLocalLLM, setUseLocalLLM] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // AF Framework State
  const [isAFModalVisible, setAFModalVisible] = useState(false);
  const [toolsConfig, setToolsConfig] = useState<Record<string, boolean>>({
    zomato: true,
    makemytrip: true,
    redbus: true,
    blinkit: true,
    chromepe: true
  });

  useEffect(() => {
    const startSub = speechEmitter.addListener('onSpeechStart', () => setIsListening(true));
    const endSub = speechEmitter.addListener('onSpeechEnd', () => setIsListening(false));
    const resultSub = speechEmitter.addListener('onSpeechResults', (text: string) => {
      if (text) {
        setInputText(text);
      }
    });
    const errorSub = speechEmitter.addListener('onSpeechError', (err: string) => {
      // Use console.log instead of console.error to prevent RedBox for common errors like 7 (NO_MATCH)
      console.log('Speech error:', err);
      setIsListening(false);
    });

    return () => {
      startSub.remove();
      endSub.remove();
      resultSub.remove();
      errorSub.remove();
    };
  }, []);

  const startListening = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'Iqooistant needs access to your microphone so you can speak to it.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.warn('Microphone permission denied');
        return;
      }
    }
    try {
      CustomSpeech.startListening();
    } catch (e) {
      console.error(e);
    }
  };

  const stopListening = () => {
    try {
      CustomSpeech.stopListening();
    } catch (e) {
      console.error(e);
    }
  };

  const handledDeepLink = useRef<string | null>(null);
  const activeTransactionId = useRef<string | null>(null);

  useEffect(() => {
    const handleUrl = (url: string | null | undefined) => {
      if (url && url.includes('iqooistant://')) {
        if (handledDeepLink.current === url) return;
        handledDeepLink.current = url;
        
        activeTransactionId.current = null; // Clear active txn

        if (url.includes('status=declined')) {
          setMessages((prev) => [
            ...prev,
            { id: Date.now().toString(), type: 'assistant', text: '❌ Payment declined by user. Order canceled.' }
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { id: Date.now().toString(), type: 'assistant', text: '✅ Payment successfully received! Your order is confirmed.' }
          ]);
        }
      }
    };

    // Check if app was opened from deep link when fully closed
    Linking.getInitialURL().then(handleUrl);

    // Check if app was already in background
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => {
      subscription.remove();
    };
  }, []);

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
        if (['place_order', 'book_trip', 'book_bus', 'place_grocery_order'].includes(toolName)) {
          const txnId = Date.now().toString();
          activeTransactionId.current = txnId;
          
          setMessages((prev) => [...prev, {
            id: txnId,
            type: 'tool_chromepe',
            toolData: { amount: toolArgs?.total || 0 },
          }]);

          // Auto-cancel if not approved in 30 seconds
          setTimeout(() => {
            if (activeTransactionId.current === txnId) {
              activeTransactionId.current = null;
              setMessages((prev) => [...prev, {
                id: Date.now().toString(), type: 'assistant', text: '⏳ Payment timed out after 30 seconds. Transaction auto-canceled.'
              }]);
            }
          }, 30000);
        } else if (['search_hotels', 'select_hotel'].includes(toolName)) {
          setMessages((prev) => [...prev, {
            id: Date.now().toString(),
            type: 'tool_makemytrip',
            toolData: { query: toolName === 'search_hotels' ? 'Searching hotels...' : 'Selecting hotel...' },
          }]);
        } else if (['search_buses', 'select_bus'].includes(toolName)) {
          setMessages((prev) => [...prev, {
            id: Date.now().toString(),
            type: 'tool_redbus',
            toolData: { query: toolName === 'search_buses' ? 'Searching buses...' : 'Selecting bus...' },
          }]);
        } else if (['browse_groceries', 'add_grocery_to_cart'].includes(toolName)) {
          setMessages((prev) => [...prev, {
            id: Date.now().toString(),
            type: 'tool_blinkit',
            toolData: { query: toolName === 'browse_groceries' ? 'Browsing Groceries...' : 'Adding to Cart...' },
          }]);
        } else if (['browse_menu', 'add_to_cart', 'view_cart'].includes(toolName)) {
          setMessages((prev) => [...prev, {
            id: Date.now().toString(),
            type: 'tool_zomato',
            toolData: { query: toolName === 'browse_menu' ? 'Browsing menu...' : 'Adding to cart...' },
          }]);
        }
      }, useLocalLLM, toolsConfig);

      setChatHistory(finalHistory);
      
      // Extract hotel and bus results if any
      const newUIMessages: Message[] = [];
      const addedMessages = finalHistory.slice(newHistory.length);
      for (const msg of addedMessages) {
        if (msg.role === 'tool' && msg.name === 'search_hotels') {
          try {
            const result = JSON.parse(msg.content || '{}');
            if (result.success && result.hotels) {
              newUIMessages.push({
                id: (msg.tool_call_id || Date.now().toString()) + '_hotels',
                type: 'tool_makemytrip_hotels',
                toolData: { hotels: result.hotels }
              });
            }
          } catch(e) {}
        }
        if (msg.role === 'tool' && msg.name === 'search_buses') {
          try {
            const result = JSON.parse(msg.content || '{}');
            if (result.success && result.buses) {
              newUIMessages.push({
                id: (msg.tool_call_id || Date.now().toString()) + '_buses',
                type: 'tool_redbus_buses',
                toolData: { buses: result.buses }
              });
            }
          } catch(e) {}
        }
      }
      
      // Extract the final assistant text
      const lastMessage = finalHistory[finalHistory.length - 1];
      if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content) {
        newUIMessages.push({
          id: Date.now().toString(),
          type: 'assistant',
          text: lastMessage.content,
        });
      }

      if (newUIMessages.length > 0) {
        setMessages((prev) => [...prev, ...newUIMessages]);
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
    if (item.type === 'tool_makemytrip') {
      return (
        <View style={styles.toolWrapper}>
          <ToolCallIndicator type="makemytrip" data={item.toolData} />
        </View>
      );
    }
    if (item.type === 'tool_redbus') {
      return (
        <View style={styles.toolWrapper}>
          <ToolCallIndicator type="redbus" data={item.toolData} />
        </View>
      );
    }
    if (item.type === 'tool_blinkit') {
      return (
        <View style={styles.toolWrapper}>
          <ToolCallIndicator type="blinkit" data={item.toolData} />
        </View>
      );
    }
    if (item.type === 'tool_makemytrip_hotels') {
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginVertical: 12}} contentContainerStyle={{paddingHorizontal: 16}}>
          {item.toolData.hotels.map((hotel: any) => (
            <View key={hotel.id} style={styles.hotelCard}>
              <Image source={{ uri: hotel.image_url }} style={styles.hotelImage} resizeMode="cover" />
              <View style={styles.hotelInfo}>
                <Text style={styles.hotelName} numberOfLines={1}>{hotel.name}</Text>
                <Text style={styles.hotelDetails}>{hotel.city} • ⭐ {hotel.rating}</Text>
                <Text style={styles.hotelPrice}>₹{hotel.price} <Text style={styles.hotelPriceNight}>/ night</Text></Text>
              </View>
            </View>
          ))}
        </ScrollView>
      );
    }
    if (item.type === 'tool_redbus_buses') {
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginVertical: 12}} contentContainerStyle={{paddingHorizontal: 16}}>
          {item.toolData.buses.map((bus: any) => (
            <View key={bus.id} style={styles.busCard}>
              <View style={styles.busHeader}>
                <Text style={styles.busOperator} numberOfLines={1}>{bus.operator}</Text>
                <Text style={styles.busRating}>⭐ {bus.rating}</Text>
              </View>
              <Text style={styles.busType}>{bus.type}</Text>
              <Text style={styles.busRoute}>{bus.route}</Text>
              <View style={styles.busFooter}>
                <Text style={styles.busTime}>{bus.departure} - {bus.arrival}</Text>
                <Text style={styles.busPrice}>₹{bus.price}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
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
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <TouchableOpacity onPress={() => setAFModalVisible(true)} style={[styles.reloadButton, {marginRight: 8, backgroundColor: '#0a84ff'}]}>
              <Text style={[styles.reloadIcon, {color: '#ffffff', fontSize: 13, fontWeight: '700'}]}>AF</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setUseLocalLLM(!useLocalLLM)} style={[styles.reloadButton, {marginRight: 8, backgroundColor: useLocalLLM ? '#34c759' : '#f0f0f5'}]}>
              <Text style={[styles.reloadIcon, {color: useLocalLLM ? '#fff' : '#8e8e93', fontSize: 12}]}>{useLocalLLM ? 'LOCAL' : 'GLOBAL'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={resetChat} style={styles.reloadButton}>
              <Text style={styles.reloadIcon}>⟳</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* AF Framework Modal */}
        <Modal
          visible={isAFModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setAFModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>App Framework (AF)</Text>
                <TouchableOpacity onPress={() => setAFModalVisible(false)}>
                  <Text style={styles.modalCloseText}>Done</Text>
                </TouchableOpacity>
              </View>
              
              <ScrollView style={{width: '100%'}}>
                {[
                  { id: 'zomato', name: 'Zomato', logo: ZOMATO_LOGO, bgColor: '#e23744' },
                  { id: 'makemytrip', name: 'MakeMyTrip', logo: MAKEMYTRIP_LOGO, bgColor: '#d83e28' },
                  { id: 'redbus', name: 'RedBus', logo: REDBUS_LOGO, bgColor: '#d84e55' },
                  { id: 'blinkit', name: 'Blinkit', logo: BLINKIT_LOGO, bgColor: '#f2cf3f' },
                  { id: 'chromepe', name: 'ChromePe', logo: CHROMEPE_LOGO, bgColor: '#000000' },
                ].map(app => (
                  <View key={app.id} style={styles.appToggleRow}>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                      <Image source={app.logo} style={[styles.appToggleLogo, { backgroundColor: app.bgColor }]} resizeMode="contain" />
                      <Text style={styles.appToggleName}>{app.name}</Text>
                    </View>
                    <Switch
                      value={toolsConfig[app.id]}
                      onValueChange={(val) => setToolsConfig(prev => ({...prev, [app.id]: val}))}
                      trackColor={{ false: '#e5e5ea', true: '#34c759' }}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            isTyping ? (
              <View style={[styles.agentMessageBubble, { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingVertical: 10, paddingHorizontal: 16 }]}>
                <ActivityIndicator size="small" color="#8e8e93" style={{ marginRight: 8 }} />
                <Text style={{ color: '#1a1a1c', fontSize: 14 }}>Processing...</Text>
              </View>
            ) : null
          }
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
          {(!isListening && inputText.trim().length > 0) ? (
            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSend}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: '#0a84ff' }]}
              onPressIn={startListening}
              onPressOut={stopListening}
              delayPressIn={0}
            >
              <Image 
                source={{ uri: 'https://img.icons8.com/ios-filled/50/ffffff/microphone.png' }}
                style={{ width: 24, height: 24, tintColor: '#ffffff' }}
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
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
  hotelCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginRight: 12,
    width: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  hotelImage: {
    width: 220,
    height: 140,
    backgroundColor: '#e5e5ea',
  },
  hotelInfo: {
    padding: 12,
  },
  hotelName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1c1c1e',
    marginBottom: 4,
  },
  hotelDetails: {
    fontSize: 13,
    color: '#8e8e93',
    marginBottom: 8,
  },
  hotelPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#34c759',
  },
  hotelPriceNight: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8e8e93',
  },
  busCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginRight: 12,
    width: 240,
    padding: 16,
    shadowColor: '#d84e55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#d84e55',
  },
  busHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  busOperator: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1c1c1e',
    flex: 1,
  },
  busRating: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ff9500',
  },
  busType: {
    fontSize: 13,
    color: '#8e8e93',
    marginBottom: 12,
  },
  busRoute: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 12,
    backgroundColor: '#f2f2f7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  busFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  busTime: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3a3a3c',
  },
  busPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#34c759',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: '50%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f7',
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1c1c1e',
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a84ff',
  },
  appToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f7',
  },
  appToggleLogo: {
    width: 32,
    height: 32,
    marginRight: 12,
    borderRadius: 8,
  },
  appToggleName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1c1e',
  },
});
