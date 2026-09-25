import OpengraphImage from "../opengraph-image";

// The demo's link-preview image. The static export can't produce the
// /opengraph-image metadata route, so the same image is written as a PNG file.
export const dynamic = "force-static";

export function GET() {
  return OpengraphImage();
}
