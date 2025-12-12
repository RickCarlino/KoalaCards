import { notifications } from "@mantine/notifications";

type NotifyColor = "red" | "green";

function notify(params: {
  title: string;
  message: string;
  color: NotifyColor;
}) {
  notifications.show(params);
}

export function notifyError() {
  notify({
    title: "Error",
    message: "Something went wrong. Please try again.",
    color: "red",
  });
}

export function notifyValidationError(title: string, message: string) {
  notify({ title, message, color: "red" });
}

export function notifySuccess(title: string, message: string) {
  notify({ title, message, color: "green" });
}
