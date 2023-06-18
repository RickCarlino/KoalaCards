import Authed from "./_authed";

export default function User() {
  return (
    Authed(<p>
      Eventually, I want this page to allow things like changing email address,
      changing password, and deleting account. It also needs stats on how much
      you have studied.
    </p>)
  );
}
