// Check if the device supports haptics
const hasHaptics = () => {
  return (
    'vibrate' in navigator ||
    'haptics' in window ||
    'Haptics' in window ||
    'userHaptic' in window ||
    'vibrate' in window
  );
};

// iOS Haptics
const tryIOSHaptics = (style: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning') => {
  // @ts-ignore - TypeScript doesn't know about these APIs yet
  const haptics = window?.Haptics || window?.haptics || window?.userHaptic;
  
  if (haptics) {
    try {
      switch (style) {
        case 'light':
          haptics.selectionStart();
          break;
        case 'medium':
          haptics.impactMedium();
          break;
        case 'heavy':
          haptics.impactHeavy();
          break;
        case 'success':
          haptics.notificationSuccess();
          break;
        case 'error':
          haptics.notificationError();
          break;
        case 'warning':
          haptics.notificationWarning();
          break;
      }
    } catch (e) {
      console.warn('Haptics failed:', e);
    }
  }
};

// Android/General vibration
const tryVibrate = (pattern: number | number[]) => {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn('Vibration failed:', e);
    }
  }
};

// Unified haptic feedback function
export const haptic = (style: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning') => {
  if (!hasHaptics()) return;

  // Try iOS-specific haptics first
  tryIOSHaptics(style);

  // Fallback to vibration API with different patterns for different styles
  switch (style) {
    case 'light':
      tryVibrate(10);
      break;
    case 'medium':
      tryVibrate([30, 50, 30]);
      break;
    case 'heavy':
      tryVibrate([50, 100, 50]);
      break;
    case 'success':
      tryVibrate([50, 50, 100]);
      break;
    case 'error':
      tryVibrate([100, 30, 100, 30, 100]);
      break;
    case 'warning':
      tryVibrate([50, 100, 50, 100]);
      break;
  }
}; 