// --- 1. THREE.JS SETUP ---
const canvas = document.querySelector('.output_canvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.z = 50;

// Particle Variables
const particleCount = 5000;
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);
const colors = new Float32Array(particleCount * 3);

// Initialize particles randomly
for (let i = 0; i < particleCount * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 100;
    colors[i] = Math.random();
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const material = new THREE.PointsMaterial({
    size: 0.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
});

const particleSystem = new THREE.Points(geometry, material);
scene.add(particleSystem);

// --- 2. SHAPE GENERATORS ---
function getHeartPosition(t, scale = 1) {
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const z = (Math.random() - 0.5) * 5;
    return new THREE.Vector3(x * scale, y * scale, z * scale);
}

function morphToShape(shapeType) {
    const targetPositions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
        let target;
        if (shapeType === 'heart') {
            const t = Math.random() * Math.PI * 2;
            target = getHeartPosition(t, 1.5);
        } else {
            // Default random sphere
            target = new THREE.Vector3(
                (Math.random() - 0.5) * 50,
                (Math.random() - 0.5) * 50,
                (Math.random() - 0.5) * 50
            );
        }

        targetPositions[i * 3] = target.x;
        targetPositions[i * 3 + 1] = target.y;
        targetPositions[i * 3 + 2] = target.z;
    }

    // Animate transition using GSAP
    gsap.to(particleSystem.geometry.attributes.position.array, {
        endArray: targetPositions,
        duration: 2,
        ease: "power2.inOut",
        onUpdate: () => {
            particleSystem.geometry.attributes.position.needsUpdate = true;
        }
    });
}

// --- 3. MEDIAPIPE HAND TRACKING SETUP ---
const videoElement = document.querySelector('.input_video');
let currentShape = 'random';

function onResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const hand = results.multiHandLandmarks[0];
        
        // Landmark 4 is Thumb tip, Landmark 8 is Index Finger tip
        const thumbTip = hand[4];
        const indexTip = hand[8];
        
        // Calculate distance for "pinch" gesture to control scale
        const dx = thumbTip.x - indexTip.x;
        const dy = thumbTip.y - indexTip.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Control Particle Expansion based on hand open/close
        const targetScale = 1 + (distance * 10);
        particleSystem.scale.set(targetScale, targetScale, targetScale);
        
        // Rotate system based on hand X/Y movement
        particleSystem.rotation.y = (thumbTip.x - 0.5) * Math.PI;
        particleSystem.rotation.x = (thumbTip.y - 0.5) * Math.PI;

        // Switch templates: if hand is wide open, show heart
        if (distance > 0.2 && currentShape !== 'heart') {
            currentShape = 'heart';
            morphToShape('heart');
            material.color.setHex(0xff0055); // Change color to red/pink
        } else if (distance < 0.05 && currentShape !== 'random') {
            currentShape = 'random';
            morphToShape('random');
            material.color.setHex(0xffffff); // Reset color
        }
    }
}

const hands = new Hands({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});
hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});
hands.onResults(onResults);

const cameraUtils = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({image: videoElement});
  },
  width: 640,
  height: 480
});
cameraUtils.start();

// --- 4. ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);
    // Add subtle ambient rotation
    particleSystem.rotation.z += 0.002;
    renderer.render(scene, camera);
}

animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
