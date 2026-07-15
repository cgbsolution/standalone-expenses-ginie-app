// Chat tab: a single WebView that fills the screen down to the tab bar.
// We inject the welcome card HTML INTO the chat host's page so it sits at the
// top of the chat scroll — when messages arrive, the welcome scrolls away
// naturally, exactly like the old NativeChatScreen design.

import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { toast, actionSheet } from './ui';
import { useAuth } from '../context/AuthContext';
import { buildChatUrl } from '../config/expgenie';
import { uploadExpenseDocument } from '../api/expenseUpload';
import { GENIE_BASE64 } from './genieBase64';

function buildInjectedJs() {
  // Built once per render; contains the welcome card HTML + CSS + insertion JS.
  // The orange button posts 'expgenie-upload' to React Native, which then opens
  // the native document picker and uploads.
  return `
    (function() {
      try {
        // Hide the chat host's own top bar — selector + colour + text — but
        // DO NOT touch the form / input layout. The chat host already pins
        // the input at the bottom of its container; overriding it just breaks
        // the layout (creates a gap above the tab bar).
        var hideCss = '' +
          'header,[role="banner"],.header,.app-header,.chat-header,.bot-header,nav { display:none !important; } ' +
          'html, body { padding-top:0 !important; margin-top:0 !important; }';
        var hideStyle = document.createElement('style');
        hideStyle.appendChild(document.createTextNode(hideCss));
        document.head.appendChild(hideStyle);

        // Aggressive hider: find any blue-ish element near the top and hide it.
        // Runs on a timer + MutationObserver because chat host renders late.
        function looksBlue(el) {
          try {
            var cs = window.getComputedStyle(el);
            var bg = cs.backgroundColor || '';
            var m = bg.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
            if (!m) return false;
            var r = +m[1], g = +m[2], b = +m[3];
            return b > 130 && b > r + 30 && b > g + 30;
          } catch (e) { return false; }
        }
        function killTopBar() {
          try {
            var nodes = document.querySelectorAll('header, nav, div, section, aside');
            for (var i = 0; i < nodes.length; i++) {
              var el = nodes[i];
              // Don't touch our own welcome card or anything inside it.
              if (el.closest && el.closest('.expgenie-welcome')) continue;

              var t = (el.textContent || '').trim();
              // Direct "Expense Bot" element — short, distinctive text.
              if (t === 'Expense Bot' || (t.length < 40 && t.indexOf('Expense Bot') !== -1)) {
                el.style.setProperty('display', 'none', 'important');
                continue;
              }

              // Short blue bar anywhere on the page (post-welcome-card position is fine).
              var rect;
              try { rect = el.getBoundingClientRect(); } catch (e) { continue; }
              if (rect.height > 0 && rect.height < 70 && rect.width > 200 && looksBlue(el)) {
                el.style.setProperty('display', 'none', 'important');
              }
            }
          } catch (e) {}
        }
        killTopBar();
        setTimeout(killTopBar, 300);
        setTimeout(killTopBar, 1000);
        setTimeout(killTopBar, 2500);
        try {
          var mo = new MutationObserver(killTopBar);
          mo.observe(document.documentElement, { childList: true, subtree: true });
        } catch (e) {}

        // Style sheet for the welcome card
        var css = '' +
          '.expgenie-welcome { background:#fff; margin:14px; padding:24px 22px; border-radius:18px; box-shadow:0 2px 6px rgba(15,23,42,0.06); text-align:center; font-family:-apple-system,system-ui,Roboto,sans-serif; }' +
          '.expgenie-welcome img { width:84px; height:84px; display:block; margin:0 auto 6px; }' +
          '.expgenie-welcome h1 { font-size:28px; font-weight:800; color:#3F2A6F; margin:0 0 12px; letter-spacing:-0.5px; }' +
          '.expgenie-welcome h2 { font-size:18px; font-weight:700; color:#0F172A; margin:0 0 8px; }' +
          '.expgenie-welcome .desc { font-size:13px; color:#6B7280; line-height:20px; margin:0 0 18px; }' +
          '.expgenie-welcome button.upload { background:#F08C2E; color:#fff; border:none; border-radius:999px; padding:12px 32px; font-size:14px; font-weight:600; min-width:220px; margin-bottom:18px; cursor:pointer; -webkit-tap-highlight-color:transparent; }' +
          '.expgenie-welcome .tips { text-align:left; }' +
          '.expgenie-welcome .tip-line { font-size:15px; color:#0F172A; margin:0 0 6px; }' +
          '.expgenie-welcome .tip-label { font-weight:700; text-decoration:underline; }' +
          '.expgenie-welcome .tip-example { font-size:13px; color:#374151; line-height:20px; margin:0; }' +
          '.expgenie-welcome .tip-example strong { font-weight:700; color:#0F172A; }';
        var style = document.createElement('style');
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);

        function buildCardHtml() {
          return '<div class="expgenie-welcome">' +
            '<img src="data:image/png;base64,${GENIE_BASE64}" alt="genie" />' +
            '<h1>ExpenseGenie</h1>' +
            '<h2>Welcome to ExpenseGenie!</h2>' +
            '<p class="desc">Ready to submit expenses? I\\'ve got you<br/>Your hassle-free expense claim buddy</p>' +
            '<button class="upload" type="button">1 Click Upload &amp; Submit</button>' +
            '<div class="tips">' +
              '<p class="tip-line"><span class="tip-label">Non-Bill Expense:</span> Just type</p>' +
              '<p class="tip-example">Submit <strong>taxi fare</strong> expense of <strong>Rs. 500</strong> for <strong>15 kms.</strong> from <strong>Chinchpokli</strong> to <strong>Andheri</strong> for <strong>business meeting</strong> <strong>DD/MM/YYYY</strong></p>' +
            '</div>' +
          '</div>';
        }

        // --- Drive the chat host's OWN file uploader --------------------------
        // Clicking a real <input type=file> (or the host's attach button) makes
        // react-native-webview open the native picker; the chosen / captured file
        // is then sent as a genuine chat message — it shows in the thread and the
        // bot processes it. This replaces the old side-channel REST upload that
        // never appeared in the conversation.
        function findHostFileInput(doc) {
          try {
            var inputs = doc.querySelectorAll('input[type="file"]');
            for (var i = inputs.length - 1; i >= 0; i--) {
              if (inputs[i].closest && inputs[i].closest('.expgenie-welcome')) continue;
              return inputs[i];
            }
          } catch (e) {}
          return null;
        }
        function findHostAttachButton(doc) {
          try {
            var sel = '[aria-label*="attach" i],[aria-label*="upload" i],[aria-label*="file" i],' +
                      '[title*="attach" i],[title*="upload" i],[data-testid*="attach" i],' +
                      '[class*="attach" i],[class*="upload" i],[class*="paperclip" i]';
            var els = doc.querySelectorAll(sel);
            for (var i = 0; i < els.length; i++) {
              if (els[i].closest && els[i].closest('.expgenie-welcome')) continue;
              return els[i];
            }
          } catch (e) {}
          return null;
        }
        function triggerHostUpload() {
          // Search the top document first, then any same-origin iframes.
          var docs = [document];
          try {
            var frames = document.querySelectorAll('iframe');
            for (var i = 0; i < frames.length; i++) {
              try { if (frames[i].contentDocument) docs.push(frames[i].contentDocument); } catch (e) {}
            }
          } catch (e) {}

          for (var d = 0; d < docs.length; d++) {
            var input = findHostFileInput(docs[d]);
            if (input) { try { input.click(); return; } catch (e) {} }
          }
          for (var d2 = 0; d2 < docs.length; d2++) {
            var attach = findHostAttachButton(docs[d2]);
            if (attach) { try { attach.click(); return; } catch (e) {} }
          }
          // Couldn't reach the host uploader (e.g. a cross-origin chat frame) —
          // fall back to the native picker + REST upload on the RN side.
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage('expgenie-upload');
          }
        }

        // Pick the LARGEST element on the page with overflow-y: auto/scroll.
        // That's almost always the messages container — the one that scrolls
        // independently of the page. Inserting our welcome card as its first
        // child means the card scrolls naturally with the chat messages.
        function findMessagesContainer() {
          var best = null, bestArea = 0;
          var all = document.querySelectorAll('div, main, section, ul, ol, [role="log"]');
          for (var i = 0; i < all.length; i++) {
            var el = all[i];
            if (el === document.body || el === document.documentElement) continue;
            var cs;
            try { cs = window.getComputedStyle(el); } catch (e) { continue; }
            var oy = cs.overflowY;
            if (oy !== 'auto' && oy !== 'scroll') continue;
            var rect;
            try { rect = el.getBoundingClientRect(); } catch (e) { continue; }
            var area = rect.width * rect.height;
            if (area > bestArea) { bestArea = area; best = el; }
          }
          if (best) return best;
          // Fallback: try common class names, then <main>, then body.
          return (
            document.querySelector('.messages') ||
            document.querySelector('.chat-messages') ||
            document.querySelector('.message-list') ||
            document.querySelector('[role="log"]') ||
            document.querySelector('main') ||
            document.body
          );
        }

        function insertWelcomeCard() {
          if (document.querySelector('.expgenie-welcome')) return true;
          var container = findMessagesContainer();
          if (!container) return false;

          var temp = document.createElement('div');
          temp.innerHTML = buildCardHtml();
          var card = temp.firstChild;
          container.insertBefore(card, container.firstChild);

          // Wire orange button → drive the chat host's OWN uploader so the file
          // is sent as a real chat message. Falls back to the native picker only
          // if the host's upload control can't be reached.
          var btn = card.querySelector('button.upload');
          if (btn) {
            btn.addEventListener('click', function() { triggerHostUpload(); });
          }
          return true;
        }

        // Try a few times — chat host may render lazily.
        if (!insertWelcomeCard()) {
          setTimeout(insertWelcomeCard, 200);
          setTimeout(insertWelcomeCard, 600);
          setTimeout(insertWelcomeCard, 1200);
          setTimeout(insertWelcomeCard, 2500);
        }

      } catch (e) { /* swallow */ }
      true;
    })();
  `;
}

export default function ExpenseChatWebView() {
  const { user, isLoading } = useAuth();
  const webViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState(null);

  const email = user?.mail || user?.userPrincipalName || user?.email || '';
  const displayName =
    user?.displayName ||
    [user?.givenName, user?.surname].filter(Boolean).join(' ').trim() ||
    email;

  const chatUrl = useMemo(
    () => (email ? buildChatUrl(email, displayName) : null),
    [email, displayName],
  );

  const injectedJs = useMemo(() => buildInjectedJs(), []);

  console.log('💬 [CHAT] user email =', email, '| chatUrl =', chatUrl);

  useEffect(() => {
    if (Platform.OS === 'android') {
      (async () => {
        try {
          await ImagePicker.requestCameraPermissionsAsync();
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        } catch (e) {
          console.warn('Permission request failed:', e?.message);
        }
      })();
    }
  }, []);

  const handleReload = () => {
    setLastError(null);
    setLoading(true);
    webViewRef.current?.reload();
  };

  const handleQuickUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets?.[0];
      if (!file) return;
      const r = await uploadExpenseDocument(file.uri, file.name || 'expense');
      if (r.success) {
        toast.success('Your expense document was submitted.', 'Uploaded');
        webViewRef.current?.reload();
      } else {
        toast.error(r.error || 'Could not upload the file.', 'Upload failed');
      }
    } catch (err) {
      toast.error(err.message || 'Unexpected error.', 'Upload failed');
    }
  };

  // Android: when the chat iframe's <input type="file"> is tapped, show our native picker.
  const fileUploadCaptureRef = useRef(null);
  const handleFileUpload = async (event) => {
    if (Platform.OS !== 'android') return true;
    const { capture } = event.nativeEvent;
    fileUploadCaptureRef.current = capture;
    const pick = await actionSheet({
      title: 'Upload a receipt',
      description: 'Pick a source for your receipt or document.',
      options: [
        { label: 'Take a photo', icon: 'camera-outline', value: 'camera' },
        { label: 'Choose from gallery', icon: 'images-outline', value: 'gallery' },
        { label: 'Browse files', icon: 'folder-outline', value: 'files' },
      ],
    });
    if (!pick) {
      fileUploadCaptureRef.current?.(null);
      fileUploadCaptureRef.current = null;
      return true;
    }
    if (pick.value === 'camera') pickFromCamera();
    else if (pick.value === 'gallery') pickFromGallery();
    else if (pick.value === 'files') pickFromFiles();
    return true;
  };
  const feedFile = (asset) => {
    if (!asset || !fileUploadCaptureRef.current) return;
    fileUploadCaptureRef.current([{
      uri: asset.uri,
      type: asset.mimeType || (asset.uri.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
      name: asset.fileName || asset.name || (asset.uri.split('/').pop() || 'file'),
    }]);
    fileUploadCaptureRef.current = null;
  };
  const pickFromCamera = async () => {
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    if (!r.canceled) feedFile(r.assets?.[0]);
  };
  const pickFromGallery = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    if (!r.canceled) feedFile(r.assets?.[0]);
  };
  const pickFromFiles = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true });
    if (!r.canceled) feedFile(r.assets?.[0]);
  };

  const handleMessage = (event) => {
    const data = event?.nativeEvent?.data;
    if (data === 'expgenie-upload') {
      handleQuickUpload();
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#0078D4" />
        </View>
      </SafeAreaView>
    );
  }

  if (!chatUrl) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centerBox}>
          <Text style={styles.errorTitle}>Not signed in</Text>
          <Text style={styles.errorBody}>Sign in to load the expense chat.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <WebView
        ref={webViewRef}
        source={{ uri: chatUrl }}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        injectedJavaScript={injectedJs}
        injectedJavaScriptBeforeContentLoaded={injectedJs}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionRequestType="grant"
        mixedContentMode="always"
        onFileUpload={handleFileUpload}
        onMessage={handleMessage}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        onPermissionRequest={(event) => { event.grant?.(event.resources); }}
        onLoadStart={() => { setLoading(true); setLastError(null); }}
        onLoadEnd={() => setLoading(false)}
        onError={(e) => {
          const ne = e.nativeEvent;
          console.log('💬 [CHAT] WebView error:', ne);
          setLastError((ne.code || '') + ' ' + (ne.description || 'Load failed'));
          setLoading(false);
        }}
        onHttpError={(e) => {
          const ne = e.nativeEvent;
          console.log('💬 [CHAT] HTTP error:', ne);
          setLastError('HTTP ' + ne.statusCode + ' at ' + ne.url);
          setLoading(false);
        }}
      />

      {loading ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#0078D4" />
          <Text style={styles.loadingText}>Loading chat…</Text>
        </View>
      ) : null}

      {lastError ? (
        <View style={styles.errorOverlay}>
          <Ionicons name="warning-outline" size={28} color="#DC2626" />
          <Text style={styles.errorTitle}>Couldn't load the chat</Text>
          <Text style={styles.errorBody}>{lastError}</Text>
          <Text style={styles.errorHint} numberOfLines={2}>{chatUrl}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleReload}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F4F6' },
  webview: { flex: 1, backgroundColor: '#F3F4F6' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  loadingText: { marginTop: 10, fontSize: 13, color: '#6B7280' },
  errorOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#fff',
  },
  errorTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginTop: 8, textAlign: 'center' },
  errorBody: { fontSize: 13, color: '#6B7280', marginTop: 6, textAlign: 'center' },
  errorHint: { fontSize: 11, color: '#9CA3AF', marginTop: 8, textAlign: 'center' },
  retryButton: {
    marginTop: 14, paddingHorizontal: 18, paddingVertical: 9,
    backgroundColor: '#0078D4', borderRadius: 8,
  },
  retryButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
