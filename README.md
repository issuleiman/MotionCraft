# MotionCraft

MotionCraft turns still images and videos into cinematic camera-motion clips directly in the browser. Upload media, choose a preset, build a custom keyframed path, preview the movement, and export a WebM or browser-supported MP4 recording.

## Run Locally

**Prerequisites:** Node.js 20+

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the dev server:

   ```bash
   npm run dev
   ```

3. Build for production:

   ```bash
   npm run build
   ```

## Notes

- WebM export is supported in Chromium-based browsers.
- MP4 export depends on browser `MediaRecorder` support. If unsupported, MotionCraft will ask you to use WebM.
- All rendering happens locally in the browser.
