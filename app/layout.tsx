import type { Metadata } from "next";
import { Inter, Merriweather } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const merriweather = Merriweather({
    weight: ["300", "400", "700"],
    subsets: ["latin"],
    variable: "--font-merriweather",
});

export const metadata: Metadata = {
    title: "Bridgeview Vista - Teacher Dashboard",
    description: "Real-time classroom progress monitoring",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${inter.variable} ${merriweather.variable} bg-stone-50 font-sans text-stone-900`}>
                {children}
            </body>
        </html>
    );
}
