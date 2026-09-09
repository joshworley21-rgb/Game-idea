import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

/**
 * Cinematic post-processing chain.
 *
 * The base chain (GTAO → bloom → SMAA) is good but flat: it grades nothing,
 * vignettes nothing, and lets the ACES output sit there unshaped. This module
 * adds a single custom shader pass that does the work a colourist would —
 * lift/gamma/gain, a warm/cool split, a vignette, and a touch of film grain —
 * all in one fragment pass so it costs one extra full-screen sample, not five.
 *
 * The pass runs after bloom and before SMAA, so the grade shapes the final
 * image and the anti-aliasing cleans up whatever the grade's grain added.
 */

/** Per-room grade so each space has its own mood, not just its own lights. */
export interface Grade {
  /** Lift: shadows toward a colour. 0 is neutral. */
  lift: [number, number, number];
  /** Gamma: midtone curve. 1 is neutral. */
  gamma: [number, number, number];
  /** Gain: highlights toward a colour. 1 is neutral. */
  gain: [number, number, number];
  /** Saturation multiplier. */
  saturation: number;
  /** Contrast around 0.5. */
  contrast: number;
  /** Vignette strength, 0-1. */
  vignette: number;
  /** Film grain amount, 0-1. */
  grain: number;
  /** Warmth of the whole image, -1 (cool) to +1 (warm). */
  temperature: number;
}

export const NEUTRAL_GRADE: Grade = {
  lift: [0, 0, 0],
  gamma: [1, 1, 1],
  gain: [1, 1, 1],
  saturation: 1,
  contrast: 0,
  vignette: 0,
  grain: 0,
  temperature: 0,
};

/** Warm, presidential: the Oval reads golden and authoritative. */
export const OVAL_GRADE: Grade = {
  lift: [0.012, 0.006, -0.004],
  gamma: [1.0, 0.99, 0.97],
  gain: [1.02, 1.0, 0.96],
  saturation: 1.06,
  contrast: 0.04,
  vignette: 0.22,
  grain: 0.035,
  temperature: 0.08,
};

/** Cooler, institutional: the Cabinet Room reads businesslike. */
export const CABINET_GRADE: Grade = {
  lift: [0.008, 0.004, 0.006],
  gamma: [0.99, 1.0, 1.01],
  gain: [0.99, 1.0, 1.02],
  saturation: 0.98,
  contrast: 0.05,
  vignette: 0.2,
  grain: 0.03,
  temperature: -0.03,
};

/** Grand, slightly cold: the Capitol chamber is monumental. */
export const CAPITOL_GRADE: Grade = {
  lift: [0.01, 0.008, 0.014],
  gamma: [0.985, 0.99, 1.0],
  gain: [0.98, 0.99, 1.02],
  saturation: 0.95,
  contrast: 0.07,
  vignette: 0.3,
  grain: 0.04,
  temperature: -0.05,
};

/** Bright, neutral: the Briefing Room is lit for cameras. */
export const PRESS_GRADE: Grade = {
  lift: [0.006, 0.006, 0.008],
  gamma: [1.0, 1.0, 1.0],
  gain: [1.0, 1.0, 1.0],
  saturation: 0.96,
  contrast: 0.03,
  vignette: 0.16,
  grain: 0.025,
  temperature: 0.0,
};

/** Warm, intimate: the Residence is home. */
export const RESIDENCE_GRADE: Grade = {
  lift: [0.02, 0.01, -0.006],
  gamma: [1.0, 0.985, 0.96],
  gain: [1.04, 1.0, 0.94],
  saturation: 1.1,
  contrast: 0.03,
  vignette: 0.28,
  grain: 0.045,
  temperature: 0.15,
};

/** Dark, contemplative: the Study is for one person. */
export const STUDY_GRADE: Grade = {
  lift: [0.004, 0.002, 0.01],
  gamma: [0.98, 0.99, 1.0],
  gain: [0.97, 0.99, 1.02],
  saturation: 0.9,
  contrast: 0.09,
  vignette: 0.38,
  grain: 0.05,
  temperature: -0.08,
};

const GradeShader = {
  name: "GradeShader",
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tSize: { value: new THREE.Vector2(1, 1) },
    uLift: { value: new THREE.Vector3(0, 0, 0) },
    uGamma: { value: new THREE.Vector3(1, 1, 1) },
    uGain: { value: new THREE.Vector3(1, 1, 1) },
    uSaturation: { value: 1 },
    uContrast: { value: 0 },
    uVignette: { value: 0 },
    uGrain: { value: 0 },
    uTemperature: { value: 0 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 tSize;
    uniform vec3 uLift;
    uniform vec3 uGamma;
    uniform vec3 uGain;
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uTemperature;
    uniform float uTime;
    varying vec2 vUv;

    // A cheap hash for film grain that does not need a texture.
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 c = texel.rgb;

      // --- Temperature: shift toward blue or orange in the highlights.
      // A simple approximation: warm adds red, takes blue; cool does the reverse.
      float warm = uTemperature * 0.08;
      c.r += warm;
      c.b -= warm;

      // --- Lift / gamma / gain (the classic ASC CDL).
      c = c * uGain + uLift;
      c = pow(max(c, vec3(0.0)), uGamma);

      // --- Contrast around 0.5.
      c = (c - 0.5) * (1.0 + uContrast) + 0.5;

      // --- Saturation in luma space.
      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(luma), c, uSaturation);

      // --- Vignette: darken toward the corners.
      vec2 centred = vUv - 0.5;
      float dist = length(centred * vec2(1.0, 1.35)); // slightly elliptical for portrait
      float vig = smoothstep(0.35, 0.95, dist);
      c *= 1.0 - vig * uVignette;

      // --- Film grain: a fine, animated noise.
      if (uGrain > 0.0) {
        float n = hash(vUv * tSize + fract(uTime) * 61.7);
        c += (n - 0.5) * uGrain * 0.12;
      }

      gl_FragColor = vec4(c, texel.a);
    }
  `,
};

/** The full post chain, with a grade pass that can be retuned per room. */
export class PostFX {
  readonly composer: EffectComposer;
  private gradePass: ShaderPass;
  private grade: Grade = NEUTRAL_GRADE;
  private clock = new THREE.Clock();

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
  ) {
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    // Half-resolution GTAO: occlusion is low-frequency, the denoise sells it.
    const gtao = new GTAOPass(scene, camera, width * 0.5, height * 0.5);
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.updateGtaoMaterial({
      radius: 0.3,
      distanceExponent: 1.4,
      thickness: 0.6,
      scale: 1.05,
      samples: 8,
      distanceFallOff: 1,
      screenSpaceRadius: false,
    });
    gtao.blendIntensity = 0.85;
    composer.addPass(gtao);

    // Bloom: windows, fire and chandeliers glow, not the whole room.
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.35, 0.4, 0.86);
    composer.addPass(bloom);

    // The grade pass: colour, vignette, grain — one full-screen sample.
    this.gradePass = new ShaderPass(GradeShader);
    composer.addPass(this.gradePass);

    // Output (tone mapping) then SMAA cleans up the grain's edges.
    composer.addPass(new OutputPass());
    composer.addPass(new SMAAPass(width, height));

    this.composer = composer;
  }

  /** Sets the colour grade for the current room. */
  setGrade(grade: Grade): void {
    this.grade = grade;
    const u = this.gradePass.uniforms;
    u.uLift.value.set(grade.lift[0], grade.lift[1], grade.lift[2]);
    u.uGamma.value.set(grade.gamma[0], grade.gamma[1], grade.gamma[2]);
    u.uGain.value.set(grade.gain[0], grade.gain[1], grade.gain[2]);
    u.uSaturation.value = grade.saturation;
    u.uContrast.value = grade.contrast;
    u.uVignette.value = grade.vignette;
    u.uGrain.value = grade.grain;
    u.uTemperature.value = grade.temperature;
  }

  /** Advances the grain animation and renders the chain. */
  render(): void {
    this.gradePass.uniforms.uTime.value = this.clock.getElapsedTime();
    this.composer.render();
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.gradePass.uniforms.tSize.value.set(width, height);
  }

  dispose(): void {
    this.composer.dispose();
  }
}
