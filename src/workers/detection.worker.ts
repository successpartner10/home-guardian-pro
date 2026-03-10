import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

let model: cocoSsd.ObjectDetection | null = null;
let activeZone: { x: number, y: number, width: number, height: number } | null = null;

async function loadModel() {
    await tf.ready();
    model = await cocoSsd.load();
    self.postMessage({ type: 'MODEL_LOADED' });
}

self.onmessage = async (e: MessageEvent) => {
    if (e.data.type === 'LOAD_MODEL') {
        await loadModel();
    } else if (e.data.type === 'SET_ZONE') {
        activeZone = e.data.zone;
    } else if (e.data.type === 'DETECT') {
        if (!model) return;

        const { imageData, width, height } = e.data;

        // Create tensor from image data
        const tensor = tf.browser.fromPixels({
            data: new Uint8Array(imageData) as any,
            width,
            height
        } as any);

        // Detect objects
        let predictions = await model.detect(tensor);

        // Filter by zone if set
        if (activeZone) {
            predictions = predictions.filter(p => {
                const [px, py, pw, ph] = p.bbox;
                const pCenterX = px + pw / 2;
                const pCenterY = py + ph / 2;

                // Coordinates in imageData are 320x240, normalize activeZone if needed
                // Assuming activeZone is already normalized or matches 320x240
                return (
                    pCenterX >= activeZone.x &&
                    pCenterX <= activeZone.x + activeZone.width &&
                    pCenterY >= activeZone.y &&
                    pCenterY <= activeZone.y + activeZone.height
                );
            });
        }

        // Dispose tensor to free memory
        tensor.dispose();

        // Send back results
        self.postMessage({ type: 'DETECTIONS', predictions });
    }
};
