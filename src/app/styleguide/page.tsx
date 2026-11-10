import type { Metadata } from "next";
import { StyleguideView } from "./styleguide-view";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

export default function StyleguidePage() {
  return <StyleguideView />;
}
