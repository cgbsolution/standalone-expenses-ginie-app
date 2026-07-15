import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Pressable,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from './tokens';

let _handler = null;
const SCREEN_H = Dimensions.get('window').height;

export function actionSheet(opts) {
  return new Promise((resolve) => {
    if (!_handler) {
      if (__DEV__) console.warn('ActionSheetHost not mounted.');
      resolve(null);
      return;
    }
    _handler({ ...opts, resolve });
  });
}

export function ActionSheetHost() {
  const [current, setCurrent] = useState(null);
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    _handler = (opts) => setCurrent(opts);
    return () => { _handler = null; };
  }, []);

  useEffect(() => {
    if (current) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: tokens.motion.base, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }),
      ]).start();
    }
  }, [current]);

  const close = (result) => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: tokens.motion.base, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: SCREEN_H, duration: tokens.motion.base, useNativeDriver: true }),
    ]).start(() => {
      current?.resolve(result);
      setCurrent(null);
    });
  };

  if (!current) return null;

  const options = current.options || [];
  const hasDescription = !!current.description;

  return (
    <Modal transparent visible animationType="none" onRequestClose={() => close(null)}>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close(null)} />
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY }], paddingBottom: insets.bottom + tokens.space.md },
          ]}
        >
          <View style={styles.grabber} />

          {(current.title || current.description) ? (
            <View style={styles.header}>
              {current.title ? <Text style={styles.title}>{current.title}</Text> : null}
              {hasDescription ? <Text style={styles.description}>{current.description}</Text> : null}
            </View>
          ) : null}

          <View style={styles.optionsCard}>
            {options.map((opt, i) => {
              const isDestructive = opt.destructive;
              const color = isDestructive ? tokens.color.danger : tokens.color.text;
              return (
                <React.Fragment key={opt.label + i}>
                  {i > 0 ? <View style={styles.divider} /> : null}
                  <TouchableOpacity
                    style={styles.option}
                    onPress={() => close(opt)}
                    activeOpacity={0.6}
                  >
                    {opt.icon ? (
                      <Ionicons name={opt.icon} size={20} color={color} style={styles.optionIcon} />
                    ) : null}
                    <Text style={[styles.optionLabel, { color }]}>{opt.label}</Text>
                    {opt.detail ? (
                      <Text style={styles.optionDetail}>{opt.detail}</Text>
                    ) : null}
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.optionsCard, styles.cancelCard]}
            onPress={() => close(null)}
            activeOpacity={0.6}
          >
            <Text style={styles.cancelLabel}>{current.cancelLabel || 'Cancel'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: tokens.color.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    paddingHorizontal: tokens.space.md,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: tokens.radius.full,
    backgroundColor: 'rgba(255,255,255,0.4)',
    alignSelf: 'center',
    marginBottom: tokens.space.md,
  },
  header: {
    alignItems: 'center',
    paddingVertical: tokens.space.md,
    paddingHorizontal: tokens.space.lg,
    marginBottom: tokens.space.sm,
  },
  title: {
    fontSize: tokens.font.md,
    fontWeight: tokens.weight.semibold,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  description: {
    fontSize: tokens.font.sm,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 4,
  },
  optionsCard: {
    backgroundColor: tokens.color.bg,
    borderRadius: tokens.radius.lg,
    overflow: 'hidden',
    ...tokens.shadow.pop,
  },
  cancelCard: {
    marginTop: tokens.space.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.color.border,
    marginLeft: tokens.space.lg + 28,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.space.lg,
    height: 56,
  },
  optionIcon: {
    marginRight: tokens.space.md,
    width: 24,
    textAlign: 'center',
  },
  optionLabel: {
    flex: 1,
    fontSize: tokens.font.lg,
    fontWeight: tokens.weight.medium,
  },
  optionDetail: {
    fontSize: tokens.font.sm,
    color: tokens.color.textSubtle,
  },
  cancelLabel: {
    fontSize: tokens.font.lg,
    fontWeight: tokens.weight.semibold,
    color: tokens.color.text,
    textAlign: 'center',
    paddingVertical: tokens.space.lg,
  },
});
