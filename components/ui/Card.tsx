import React from 'react';
import { View, ViewProps } from 'react-native';

export type CardProps = ViewProps & {
  elevated?: boolean;
  padded?: boolean;
  rounded?: number;
};

export function Card({ elevated = true, padded = true, rounded = 16, style, children, ...rest }: CardProps) {
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: 'white',
          borderRadius: rounded,
          borderWidth: 1,
          borderColor: '#e5e7eb',
          padding: padded ? 12 : 0,
          shadowColor: elevated ? '#000' : undefined,
          shadowOpacity: elevated ? 0.08 : 0,
          shadowRadius: elevated ? 8 : 0,
          shadowOffset: elevated ? { width: 0, height: 2 } : undefined,
          elevation: elevated ? 3 : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export default Card;


