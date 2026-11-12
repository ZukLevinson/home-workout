import { Platform } from 'react-native';

export const lightColors = {
  background: '#f8fafc',
  foreground: '#0f172a',
  card: '#ffffff',
  border: '#e2e8f0',
  primary: '#2563eb',
  primaryForeground: '#ffffff',
  primarySoft: 'rgba(37, 99, 235, 0.14)',
  secondary: '#f1f5f9',
  secondaryForeground: '#1e293b',
  mutedForeground: '#64748b',
  success: '#059669',
  successSoft: '#ecfdf5',
  danger: '#e11d48',
  dangerSoft: '#fff1f2',
};

export const darkColors = {
  background: '#0b1120',
  foreground: '#f1f5f9',
  card: '#131c31',
  border: '#1e293b',
  primary: '#3b82f6',
  primaryForeground: '#ffffff',
  primarySoft: 'rgba(59, 130, 246, 0.22)',
  secondary: '#1e293b',
  secondaryForeground: '#e2e8f0',
  mutedForeground: '#94a3b8',
  success: '#34d399',
  successSoft: 'rgba(16, 185, 129, 0.14)',
  danger: '#fb7185',
  dangerSoft: 'rgba(244, 63, 94, 0.14)',
};

export function fontForWeight(weight = 'regular', fontsLoaded = false) {
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
