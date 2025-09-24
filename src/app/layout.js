import "@/styles/globals.css";
import { Fredoka, Mitr } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import s from "@/styles/home-shell.module.css";

const fredoka = Fredoka({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-fredoka" });
const mitr = Mitr({ subsets: ["thai"], weight: ["300", "400", "600"], variable: "--font-mitr" });

export const metadata = {
  title: "Bucketlist",
  description: "แชร์ bucket list กับเพื่อนได้ง่ายๆ",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body className={`${fredoka.variable} ${mitr.variable}`}>
        {children}
      </body>
    </html>
  );
}
