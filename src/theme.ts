import { Platform } from 'react-native';
import type { ThemeColors } from './types';

export const lightColors: ThemeColors = {
  background: '#fafafa',
  foreground: '#171717',
  card: '#ffffff',
  border: '#e5e5e5',
  primary: '#2563eb',
  primaryForeground: '#ffffff',
  primarySoft: '#eff6ff',
  secondary: '#f5f5f5',
  secondaryForeground: '#404040',
  mutedForeground: '#525252',
  success: '#16a34a',
  successSoft: '#f0fdf4',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
};

export const darkColors: ThemeColors = {
  background: '#0a0a0a',
  foreground: '#fafafa',
  card: '#171717',
  border: '#262626',
  primary: '#3b82f6',
  primaryForeground: '#ffffff',
  primarySoft: 'rgba(59, 130, 246, 0.16)',
  secondary: '#262626',
  secondaryForeground: '#d4d4d4',
  mutedForeground: '#a3a3a3',
  success: '#4ade80',
  successSoft: 'rgba(34, 197, 94, 0.14)',
  danger: '#f87171',
  dangerSoft: 'rgba(239, 68, 68, 0.14)',
};

export type FontWeightName = 'regular' | 'medium' | 'semibold' | 'bold';

export function fontForWeight(
  weight: FontWeightName = 'regular',
  fontsLoaded = false
): string | undefined {
  if (!fontsLoaded) {
    return Platform.select({
      web: 'Rubik, -apple-system, BlinkMacSystemFont, sans-serif',
      default: undefined,
    });
  }
  switch (weight) {
    case 'bold':
      return 'Rubik_700Bold';
    case 'semibold':
      return 'Rubik_600SemiBold';
    case 'medium':
      return 'Rubik_500Medium';
    default:
      return 'Rubik_400Regular';
  }
}
