import { Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export type PermissionResult = 'granted' | 'limited' | 'denied';

function openSettings() {
  Linking.openSettings().catch(() => {
    Alert.alert('Unable to Open Settings', 'Please go to Settings manually to grant access.');
  });
}

function showSettingsAlert(title: string, body: string) {
  Alert.alert(title, body, [
    { text: 'Not Now', style: 'cancel' },
    { text: 'Open Settings', onPress: openSettings },
  ]);
}

export async function requestCameraPermission(): Promise<PermissionResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();

  if (perm.granted) return 'granted';

  if (!perm.canAskAgain) {
    showSettingsAlert(
      'Camera Access Required',
      'Expense Roaster needs camera access to photograph receipts. Please enable it in Settings.',
    );
  }
  return 'denied';
}

export async function requestPhotoLibraryPermission(): Promise<PermissionResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (perm.granted) {
    const privileges = (perm as unknown as { accessPrivileges?: string }).accessPrivileges;
    if (privileges === 'limited') return 'limited';
    return 'granted';
  }

  if (!perm.canAskAgain) {
    showSettingsAlert(
      'Photos Access Required',
      'Expense Roaster needs access to your photo library to upload receipts. Please enable it in Settings — you can choose "All Photos" or "Selected Photos".',
    );
  }
  return 'denied';
}
