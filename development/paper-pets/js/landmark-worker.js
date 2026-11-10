// Runs the OWL-ViT detector off the main thread so the 3D view keeps rendering.
let detP = null;
let queue = Promise.resolve();

// one ONNX session can't run two inferences at once, so requests run in order
self.onmessage = (e) => { queue = queue.then(() => handle(e)); };

async function handle(e) {
  const { id, url, labels, opts } = e.data;
  try {
    if (!detP) {
      // wasm only: the WebGPU path returned no usable detections in testing
      detP = import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2')
        .then((T) => T.pipeline('zero-shot-object-detection', 'Xenova/owlvit-base-patch32'));
    }
    const det = await detP;
    const result = url ? await det(url, labels, opts) : [];
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
}
