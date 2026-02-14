import { useEffect } from 'react';
import AppRouter from './routes/AppRouter';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ClientAuthProvider } from './context/ClientAuthContext';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ClientAuthProvider>
          <AppRouter />
        </ClientAuthProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
