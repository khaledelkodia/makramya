import type { Metadata } from "next";
import "./globals.css";
import "./overrides.css";
import "./hero-mobile.css";
import "./dashboard.css";
import "./category-manager.css";
import "./customer-account.css";
import "./customer-account-extra.css";

export const metadata: Metadata = {
  title: { default: "مكرمية | حرفة يدوية بلمسة من البيت", template: "%s | مكرمية" },
  description: "ستائر ومكرميات معمولة بإيدين بتحب الشغل الحلو. قطعة مخصوص ليكي، على المقاس واللون اللي بتحلمي بيه.",
  applicationName: "مكرمية",
  keywords: ["مكرمية", "مكرميات حائط", "ستائر مكرمية", "ديكور منزلي يدوي", "macrame Egypt", "ستائر حسب المقاس"],
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  openGraph: { title: "مكرمية | حرفة يدوية بلمسة من البيت", description: "ستائر ومكرميات يدوية معمولة مخصوص ليكي، على المقاس واللون اللي بتحلمي بيه.", url: "/", siteName: "مكرمية", images: [{ url: "/hero.png", width: 1672, height: 942, alt: "مكرمية قطنية يدوية في بيت دافي" }], locale: "ar_EG", type: "website" },
  twitter: { card: "summary_large_image", title: "مكرمية | حرفة يدوية بلمسة من البيت", description: "ستائر ومكرميات يدوية معمولة مخصوص ليكي.", images: ["/hero.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
