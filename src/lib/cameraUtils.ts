import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export const isNativePlatform = () => {
  return Capacitor.isNativePlatform();
};

export const takePictureNative = async (): Promise<string | null> => {
  try {
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
  } catch (error) {
    console.error('Error taking picture:', error);
    throw error;
  }
};

export const pickImageNative = async (): Promise<string | null> => {
  try {
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
  } catch (error) {
    console.error('Error picking image:', error);
    throw error;
  }
};
