// Stub para el build de preview — face-api no se usa en la demo
export const nets = { tinyFaceDetector: { loadFromUri: async () => {} }, faceLandmark68TinyNet: { loadFromUri: async () => {} } };
export const detectSingleFace = () => ({ withFaceLandmarks: () => Promise.resolve(undefined) });
export class TinyFaceDetectorOptions {}
