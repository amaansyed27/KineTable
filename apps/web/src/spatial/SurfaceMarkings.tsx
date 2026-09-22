import { CanvasTexture, SRGBColorSpace } from "three";
const textures = new Map<string, CanvasTexture>();
// Original presentation markings; labels are not a verified pinout.
function markings(kind: string) {
  const cached = textures.get(kind);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 1024;
  const c = canvas.getContext("2d")!;
  c.textAlign = "center"; c.textBaseline = "middle";
  c.fillStyle = "#d8e0ce";
  if (kind === "breadboard") {
    c.fillStyle = "#7b8075"; c.font = "12px Arial";
    for (let row = 0; row < 20; row++) c.fillText(String(row + 1), 256, 65 + row * 47.1);
    c.font = "14px Arial";
    "edcba".split("").forEach((l, i) => c.fillText(l, 107 + i * 28, 27));
    "fghij".split("").forEach((l, i) => c.fillText(l, 293 + i * 28, 27));
    c.font = "18px Arial";
    for (const side of [-1, 1]) {
      c.fillStyle = "#9a635b"; c.fillText("+", 256 + side * 242, 28);
      c.fillStyle = "#647d86"; c.fillText("−", 256 + side * 180, 28);
    }
  } else if (kind === "esp32" || kind === "pico") {
    c.strokeStyle = kind === "pico" ? "#4c8566" : "#466250"; c.lineWidth = 2;
    for (let i = 0; i < 15; i++) {
      const y = 90 + i * 56;
      for (const side of [-1, 1]) {
        c.beginPath(); c.moveTo(256 + side * 202, y);
        c.lineTo(256 + side * (115 + (i % 3) * 13), y);
        c.lineTo(256 + side * 83, y + (i % 2 ? 24 : -24)); c.stroke();
      }
    }
    c.font = "16px Arial";
    for (let i = 0; i < 15; i++) { c.fillText(String(i+1),60,90+i*56); c.fillText(String(30-i),452,90+i*56); }
    c.font = "bold 34px Arial"; c.fillText(kind === "pico" ? "PICO" : "ESP32",256,780);
    c.font = "16px Arial"; c.fillText("KINETABLE",256,825); c.fillText("3V3",105,937); c.fillText("GND",409,937);
    c.strokeStyle = "#b2bca7"; c.strokeRect(177,620,158,64);
  } else if (kind === "shield") {
    c.fillStyle = "#737e79"; c.font = "bold 60px Arial"; c.fillText("ESP32",256,280);
    c.font = "28px Arial"; c.fillText("WIRELESS MODULE",256,390);
    c.font = "22px Arial"; c.fillText("2.4 GHz",256,445);
    c.strokeStyle = "#8e9790"; c.lineWidth = 2; c.strokeRect(174,550,164,164);
    for(let i=0;i<9;i++) for(let j=0;j<9;j++) if((i*7+j*3)%5<2) c.fillRect(182+i*17,558+j*17,12,12);
  } else if (kind === "oled") {
    c.fillStyle = "#c4d5d0"; c.font = "50px monospace"; c.fillText("READY",256,415);
    c.fillStyle = "#6f9289"; c.font = "24px monospace"; c.fillText("KINETABLE",256,535); c.fillRect(90,620,330,3);
  } else if(kind === "relay") {
    c.fillStyle = "#d6e2de"; c.font = "32px Arial"; c.fillText("RELAY",256,350);
    c.font = "24px Arial"; c.fillText("5V DC",256,460);
    c.strokeStyle = "#c8d9d1"; c.lineWidth = 4; c.strokeRect(120,580,270,190);
  }
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; texture.anisotropy = 4;
  textures.set(kind, texture); return texture;
}
export function SurfaceMarkings({kind,size,position}: {kind:string;size:[number,number];position:[number,number,number]}) {
 return <mesh position={position} rotation={[-Math.PI / 2,0,0]}>
   <planeGeometry args={size} /><meshBasicMaterial map={markings(kind)} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
 </mesh>;
}
