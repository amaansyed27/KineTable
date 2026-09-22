import { DataTexture, RGBAFormat } from "three";
// A shared procedural soft shadow avoids four extra render passes per animation frame.
export function makeShadow() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const r =
        ((x - size / 2) / (size / 2)) ** 2 + ((y - size / 2) / (size / 2)) ** 2;
      const i = (y * size + x) * 4;
      data[i] = 45;
      data[i + 1] = 48;
      data[i + 2] = 36;
      data[i + 3] = Math.round(
        Math.max(0, Math.exp(-r * 5) - Math.exp(-5)) * 100,
      );
    }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}
export function SoftShadow({
  texture,
  scale = [2, 3],
  height = -0.32,
}: {
  texture: DataTexture;
  scale?: [number, number];
  height?: number;
}) {
  return (
    <mesh
      position={[0, height, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[...scale, 1]}
    >
      <planeGeometry />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}
