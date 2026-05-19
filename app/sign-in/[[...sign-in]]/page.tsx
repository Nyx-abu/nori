// P2 decision: catch-all route lets Clerk handle its own internal navigation; we keep our page wrapper minimal and matched to the cream background.
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-12 bg-accent-pink">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        afterSignInUrl="/"
      />
    </div>
  )
}
