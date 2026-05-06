/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Native + non-bundleable Node modules. Without this, webpack tries to
    // bundle their .node binaries and the dev server returns 500.
    serverComponentsExternalPackages: [
      "@anthropic-ai/sdk",
      "@xenova/transformers",   // ML inference; ships its own ONNX runtime + sharp
      "sharp",                   // native image processing (.node)
      "onnxruntime-node",        // transitive dep of @xenova/transformers
    ],
  },
};

export default nextConfig;
