import "./globals.css";
import BottomNav from "../components/BottomNav";

export const metadata = {
  title: "Kho phim",
  description: "Xem phim mới cập nhật, vietsub, thuyết minh"
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
