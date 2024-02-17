export function timeUntil(
  timestamp: number,
  now = new Date().getTime(),
): string {
  let difference = timestamp - now;

  if (difference < 0) {
    return "already past";
  }

  const secondsInYear = 31536000;
  const secondsInDay = 86400;
  const secondsInHour = 3600;
  const secondsInMinute = 60;

  // Convert milliseconds to seconds
  difference = Math.floor(difference / 1000);

  const years = Math.floor(difference / secondsInYear);
  difference -= years * secondsInYear;

  const days = Math.floor(difference / secondsInDay);
  difference -= days * secondsInDay;

  const hours = Math.floor(difference / secondsInHour);
  difference -= hours * secondsInHour;

  const minutes = Math.floor(difference / secondsInMinute);
  difference -= minutes * secondsInMinute;

  const seconds = difference;

  let result = "";
  if (years > 0) result += `${years} years `;
  if (days > 0) result += `${days} days `;
  if (hours > 0) result += `${hours} hours `;
  if (minutes > 0) result += `${minutes} minutes `;
  if (seconds > 0) result += `${seconds} seconds `;

  return result.trim();
}
