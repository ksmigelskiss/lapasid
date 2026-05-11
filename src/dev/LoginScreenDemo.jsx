// Dev-only LoginScreen preview.
// Available at /?playground=login when VITE_USE_MOCK_USER=true.
// Mock callback'ai 3s — kad pamatytum logo-as-loader animaciją per pilną ciklą.

import LoginScreen from '../components/LoginScreen'

const mockSignIn = () => new Promise(resolve => setTimeout(resolve, 3000))

export default function LoginScreenDemo() {
  return (
    <>
      <LoginScreen
        onSignInGoogle={mockSignIn}
        onSignInFacebook={mockSignIn}
        loading={false}
        error={null}
      />
      <a
        href="/?playground=loaders"
        className="fixed top-4 right-4 z-50 font-mono text-[10px] uppercase tracking-[0.18em] text-forest-600 hover:text-forest-800 bg-bone-50 px-3 py-1.5 rounded border border-bone-400/40"
      >
        ← loaders
      </a>
    </>
  )
}
