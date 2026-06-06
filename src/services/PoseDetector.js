import { Pose } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { detectSwing } from '../utils/shotEngine.js';

export default class PoseDetector {
  constructor(video, onPose, onSwing) {
    this.video = video;
    this.onPose = onPose;
    this.onSwing = onSwing;
    this.samples = [];
    this.lastSwingAt = 0;
    this.pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });
    this.pose.setOptions({
      modelComplexity: 0,
      smoothLandmarks: true,
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.55
    });
    this.pose.onResults(this.handleResults);
  }

  handleResults = (results) => {
    const landmarks = results.poseLandmarks;
    window.shadowCricketPose = landmarks;
    if (!landmarks) return;

    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    let bodyScale = 0.18; // default fallback scale
    if (leftShoulder && rightShoulder) {
      bodyScale = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);
      bodyScale = Math.max(0.05, bodyScale);
    }

    const tracked = {
      leftWrist: landmarks[15],
      rightWrist: landmarks[16],
      leftElbow: landmarks[13],
      rightElbow: landmarks[14],
      leftShoulder,
      rightShoulder
    };
    this.onPose?.(tracked);

    const rightVisibility = tracked.rightWrist?.visibility ?? 0;
    const leftVisibility = tracked.leftWrist?.visibility ?? 0;
    const useRight = rightVisibility >= leftVisibility;
    const wrist = useRight ? tracked.rightWrist : tracked.leftWrist;
    const elbow = useRight ? tracked.rightElbow : tracked.leftElbow;
    if (!wrist || !elbow || Math.max(rightVisibility, leftVisibility) < 0.35) return;

    this.samples.push({
      x: wrist.x,
      y: wrist.y,
      elbowX: elbow.x,
      elbowY: elbow.y,
      hand: useRight ? 'right' : 'left',
      t: performance.now(),
      bodyScale
    });
    this.samples = this.samples.slice(-14);
    const swing = detectSwing(this.samples, bodyScale);
    const now = performance.now();
    if (swing.swingDetected && now - this.lastSwingAt > 420) {
      this.lastSwingAt = now;
      this.onSwing?.({ ...swing, hand: useRight ? 'right' : 'left' });
    }
  };

  start() {
    this.camera = new Camera(this.video, {
      onFrame: async () => this.pose.send({ image: this.video }),
      width: 320,
      height: 240
    });
    this.camera.start();
  }

  stop() {
    this.camera?.stop();
    this.pose?.close();
  }
}
