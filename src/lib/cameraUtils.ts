import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export const isNativePlatform = () => {
  return Capacitor.isNativePlatform();
};

export const takePictureNative = async (): Promise<string | null> => {
  try {
    // Request camera permission first
    const permission = await Camera.checkPermissions();
    if (permission.camera !== 'granted') {
      const requested = await Camera.requestPermissions({ permissions: ['camera'] });
      if (requested.camera !== 'granted') {
        throw new Error('Permissão de câmera negada');
      }
    }

    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      correctOrientation: true,
    });

    if (image.base64String) {
      const mimeType = image.format === 'png' ? 'image/png' : 'image/jpeg';
      return `data:${mimeType};base64,${image.base64String}`;
    }
    return null;
  } catch (error: any) {
    console.error('Error taking picture:', error);
    if (error?.message?.includes('cancelled') || error?.message?.includes('User cancelled')) {
      return null; // User cancelled, don't throw
    }
    throw error;
  }
};

export const pickImageNative = async (): Promise<string | null> => {
  try {
    // Request photos permission first
    const permission = await Camera.checkPermissions();
    if (permission.photos !== 'granted') {
      const requested = await Camera.requestPermissions({ permissions: ['photos'] });
      if (requested.photos !== 'granted') {
        throw new Error('Permissão de fotos negada');
      }
    }

    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos,
      correctOrientation: true,
    });

    if (image.base64String) {
      const mimeType = image.format === 'png' ? 'image/png' : 'image/jpeg';
      return `data:${mimeType};base64,${image.base64String}`;
    }
    return null;
  } catch (error: any) {
    console.error('Error picking image:', error);
    if (error?.message?.includes('cancelled') || error?.message?.includes('User cancelled')) {
      return null; // User cancelled, don't throw
    }
    throw error;
  }
};
