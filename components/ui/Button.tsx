import React from 'react';
import { Pressable, Text, ViewStyle, TextStyle } from 'react-native';

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: ViewStyle;
  textStyle?: TextStyle;
  children?: React.ReactNode;
};

const VARIANT_STYLES: Record<ButtonVariant, { container: ViewStyle; text: TextStyle }> = {
  primary: {
    container: { backgroundColor: '#4f46e5' },
    text: { color: '#ffffff' },
  },
  outline: {
    container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#e5e7eb' },
    text: { color: '#111827' },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    text: { color: '#111827' },
  },
  danger: {
    container: { backgroundColor: '#ef4444' },
    text: { color: '#ffffff' },
  },
};

const SIZE_STYLES: Record<ButtonSize, { container: ViewStyle; text: TextStyle }> = {
  sm: {
    container: { height: 32, paddingHorizontal: 10, borderRadius: 8 },
    text: { fontSize: 12, fontWeight: '600' },
  },
  md: {
    container: { height: 40, paddingHorizontal: 14, borderRadius: 10 },
    text: { fontSize: 14, fontWeight: '600' },
  },
  lg: {
    container: { height: 44, paddingHorizontal: 18, borderRadius: 12 },
    text: { fontSize: 16, fontWeight: '700' },
  },
};

export function Button({
  title,
  onPress,
  disabled,
  variant = 'primary',
  size = 'md',
  style,
  textStyle,
  children,
}: ButtonProps) {
  const v = VARIANT_STYLES[variant];
  const s = SIZE_STYLES[size];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.6 : 1,
        },
        s.container,
        v.container,
        style,
      ]}
    >
      {children ? (
        children
      ) : (
        <Text style={[s.text, v.text, textStyle]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export default Button;


