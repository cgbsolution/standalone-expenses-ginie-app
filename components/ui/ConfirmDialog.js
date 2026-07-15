import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from './tokens';

let _handler = null;

const VARIANT_CONFIG = {
  default:     { icon: 'help-circle',   color: tokens.color.accent,  bg: tokens.color.accentSubtle },
  destructive: { icon: 'trash',         color: tokens.color.danger,  bg: tokens.color.dangerBg },
  warning:     { icon: 'warning',       color: tokens.color.warning, bg: tokens.color.warningBg },
  info:        { icon: 'information-circle', color: tokens.color.info, bg: tokens.color.infoBg },
};

export function confirm(opts) {
  return new Promise((resolve) => {
    if (!_handler) {
      if (__DEV__) console.warn('ConfirmHost not mounted.');
      resolve(false);
      return;
    }
    _handler({ ...opts, resolve });
  });
}

export function ConfirmHost() {
  const [current, setCurrent] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    _handler = (opts) => setCurrent(opts);
    return () => { _handler = null; };
  }, []);

  useEffect(() => {
    if (current) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: tokens.motion.base, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 8, tension: 90, useNativeDriver: true }),
      ]).start();
    } else {
      opacity.setValue(0);
      scale.setValue(0.94);
    }
  }, [current]);

  const close = (result) => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: tokens.motion.fast, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.96, duration: tokens.motion.fast, useNativeDriver: true }),
    ]).start(() => {
      current?.resolve(result);
      setCurrent(null);
    });
  };

  if (!current) return null;

  const cfg = VARIANT_CONFIG[current.variant || 'default'];
  const confirmBg = current.variant === 'destructive' ? tokens.color.danger : tokens.color.accent;

  return (
    <Modal transparent visible animationType="none" onRequestClose={() => close(false)}>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close(false)} />
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon} size={28} color={cfg.color} />
          </View>

          {current.title ? <Text style={styles.title}>{current.title}</Text> : null}
          {current.message ? <Text style={styles.message}>{current.message}</Text> : null}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnCancel]}
              onPress={() => close(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.btnCancelText}>{current.cancelLabel || 'Cancel'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: confirmBg }]}
              onPress={() => close(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.btnConfirmText}>{current.confirmLabel || 'Confirm'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: tokens.color.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: tokens.color.bg,
    borderRadius: tokens.radius.xl,
    padding: tokens.space.xl,
    alignItems: 'center',
    ...tokens.shadow.modal,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: tokens.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: tokens.space.lg,
  },
  title: {
    fontSize: tokens.font.xl,
    fontWeight: tokens.weight.semibold,
    color: tokens.color.text,
    textAlign: 'center',
    marginBottom: tokens.space.sm,
  },
  message: {
    fontSize: tokens.font.md,
    color: tokens.color.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: tokens.space.xl,
  },
  actions: {
    flexDirection: 'row',
    gap: tokens.space.md,
    width: '100%',
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: tokens.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnCancel: {
    backgroundColor: tokens.color.bgMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.border,
  },
  btnCancelText: {
    fontSize: tokens.font.md,
    fontWeight: tokens.weight.semibold,
    color: tokens.color.text,
  },
  btnConfirmText: {
    fontSize: tokens.font.md,
    fontWeight: tokens.weight.semibold,
    color: tokens.color.textOnAccent,
  },
});
