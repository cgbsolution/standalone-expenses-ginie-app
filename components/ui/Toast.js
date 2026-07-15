import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from './tokens';

let _handler = null;

const VARIANT_CONFIG = {
  success: { icon: 'checkmark-circle', color: tokens.color.success, defaultDuration: 3000 },
  error:   { icon: 'alert-circle',     color: tokens.color.danger,  defaultDuration: 4500 },
  warning: { icon: 'warning',          color: tokens.color.warning, defaultDuration: 4000 },
  info:    { icon: 'information-circle', color: tokens.color.info,  defaultDuration: 3000 },
};

export function toast(opts) {
  if (!_handler) {
    if (__DEV__) console.warn('Toast host not mounted. Wrap your app in <ToastHost />.');
    return;
  }
  _handler(typeof opts === 'string' ? { variant: 'info', message: opts } : opts);
}
toast.success = (message, title) => toast({ variant: 'success', message, title });
toast.error   = (message, title) => toast({ variant: 'error',   message, title });
toast.warning = (message, title) => toast({ variant: 'warning', message, title });
toast.info    = (message, title) => toast({ variant: 'info',    message, title });

function ToastItem({ id, variant = 'info', title, message, duration, onDismiss, index }) {
  const cfg = VARIANT_CONFIG[variant] || VARIANT_CONFIG.info;
  const translateY = useRef(new Animated.Value(-24)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: tokens.motion.base,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: tokens.motion.fast,
        useNativeDriver: true,
      }),
    ]).start();

    const t = setTimeout(() => dismiss(), duration ?? cfg.defaultDuration);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -24,
        duration: tokens.motion.fast,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: tokens.motion.fast,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss(id));
  };

  return (
    <Animated.View
      style={[
        styles.toast,
        { transform: [{ translateY }], opacity, marginTop: index === 0 ? 0 : 8 },
      ]}
    >
      <Pressable onPress={dismiss} style={styles.toastInner}>
        <View style={[styles.iconWrap, { backgroundColor: cfg.color + '1A' }]}>
          <Ionicons name={cfg.icon} size={20} color={cfg.color} />
        </View>
        <View style={styles.textWrap}>
          {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}
          {message ? (
            <Text style={styles.message} numberOfLines={3}>{message}</Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function ToastHost() {
  const [items, setItems] = useState([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    _handler = (opts) => {
      const id = Date.now() + Math.random();
      setItems((prev) => [{ id, ...opts }, ...prev].slice(0, 3));
    };
    return () => { _handler = null; };
  }, []);

  const remove = (id) => setItems((prev) => prev.filter((t) => t.id !== id));

  if (items.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
      {items.map((t, i) => (
        <ToastItem key={t.id} index={i} {...t} onDismiss={remove} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    alignItems: 'stretch',
  },
  toast: {
    backgroundColor: tokens.color.bg,
    borderRadius: tokens.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
    ...tokens.shadow.pop,
  },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: tokens.space.md,
    gap: tokens.space.md,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
    paddingTop: 2,
  },
  title: {
    fontSize: tokens.font.md,
    fontWeight: tokens.weight.semibold,
    color: tokens.color.text,
    marginBottom: 2,
  },
  message: {
    fontSize: tokens.font.md,
    color: tokens.color.textMuted,
    lineHeight: 20,
  },
});
