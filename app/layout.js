
export const metadata = {
  title: 'Video Redirect',
  description: 'Smart IP Based Redirect System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
