import type { PropsWithChildren } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { radius, spacing } from '@/theme';

export interface SheetProps extends PropsWithChildren {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Present content in a centered modal instead of bottom sheet. */
  presentation?: 'bottom' | 'modal';
}

/**
 * Minimalist bottom sheet. Crisp 12px top radius, hairline border, ultra-diffuse
 * shadow. Uses RN Modal for a native overlay; children own their scroll.
 */
export function Sheet({ visible, onClose, title, children, presentation = 'bottom' }: SheetProps) {
  const { colors: c } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="close sheet" />
        <View
          style={[
            presentation === 'modal' ? styles.modalSheet : styles.bottomSheet,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
              shadowColor: c.shadowColor,
              shadowOpacity: c.shadowOpacity,
            },
          ]}>
          <View style={[styles.handle, { backgroundColor: c.borderStrong }]} />
          {title ? <Text style={[styles.title, { color: c.ink }]}>{title}</Text> : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bottomSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
    maxHeight: '82%',
  },
  modalSheet: {
    borderRadius: radius.xl,
    borderWidth: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    margin: spacing.xl,
    padding: spacing.lg,
    maxHeight: '82%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: spacing.lg,
  },
});