export default function Home() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1>Video Redirect System</h1>
        <p>Redirect service is running.</p>
        <a href="/api/redirect">Open Redirect</a>
      </div>
    </main>
  );
}
