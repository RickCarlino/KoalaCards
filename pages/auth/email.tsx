import { useRouter } from "next/router";

export default function EmailSignin() {
  const { query } = useRouter();
  return (
    <form action="/api/auth/callback/email" method="get">
      <h1>Almost There!</h1>
      <input type="hidden" name="token" defaultValue={query.token} />
      <input
        type="hidden"
        name="callbackUrl"
        defaultValue={query.callbackUrl}
      />
      <input type="hidden" name="email" defaultValue={query.email} />
      <button type="submit">Continue to App</button>
      <h2>Having trouble signing in?</h2>
      <p>
        Please{" "}
        <a href="https://github.com/RickCarlino/KoalaCards/issues/new?title=login%20issues">
          raise an issue on Github.
        </a>
      </p>
    </form>
  );
}
