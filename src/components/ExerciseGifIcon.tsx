import React from 'react';
import { Image, View, StyleSheet, type ImageSourcePropType } from 'react-native';

const EXERCISE_GIF_MAP: Record<string, ImageSourcePropType> = {
  ex1: require('../../assets/exercises/ex1.gif'),
  ex2: require('../../assets/exercises/ex2.gif'),
  ex3: require('../../assets/exercises/ex3.gif'),
  ex4: require('../../assets/exercises/ex4.gif'),
  ex5: require('../../assets/exercises/ex5.gif'),
  ex6: require('../../assets/exercises/ex6.gif'),
  ex7: require('../../assets/exercises/ex7.gif'),
  ex8: require('../../assets/exercises/ex8.gif'),
  ex9: require('../../assets/exercises/ex9.gif'),
  ex10: require('../../assets/exercises/ex10.gif'),
};

export interface ExerciseGifIconProps {
  exerciseId: string;
  size?: number;
  active?: boolean;
  borderColor?: string;
  activeBorderColor?: string;
}

export default function ExerciseGifIcon({
  exerciseId,
  size = 60,
  active = false,
  borderColor = '#1e293b',
  activeBorderColor = '#a3e635',
}: ExerciseGifIconProps): React.ReactElement | null {
  const source = EXERCISE_GIF_MAP[exerciseId];
  if (!source) return null;

  const radius = Math.round(size * 0.24);

  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderColor: active ? activeBorderColor : borderColor,
          borderWidth: active ? 2 : 1,
        },
      ]}
    >
      <Image
        source={source}
        style={{
          width: size - (active ? 4 : 2),
          height: size - (active ? 4 : 2),
          borderRadius: Math.max(4, radius - 2),
        }}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: '#080b12',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
