import { useRouter } from "next/router";

export default function EmailSignin() {
  const { query } = useRouter();
  return (
    <form action="/api/auth/callback/email" method="get">
      <h1>Almost There!</h1>
      <input type="hidden" name="token" value={query.token} />
      <input type="hidden" name="callbackUrl" value={query.callbackUrl} />
      <input type="hidden" name="email" value={query.email} />
      <button type="submit">Continue to App</button>
      <h2>Having trouble signing in?</h2>
      <p>
        Please{" "}
        <a href="https://github.com/RickCarlino/KoalaSRS/issues/new?title=login%20issues">
          raise an issue on Github.
        </a>
      </p>
    </form>
  );
}
