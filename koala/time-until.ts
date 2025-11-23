const secondsInYear = 31536000;
const secondsInDay = 86400;
const secondsInHour = 3600;
const secondsInMinute = 60;

const calculateDiff = (timestamp: number, now: number) => {
  let difference = timestamp - now;

  const isPast = difference < 0;
  difference = Math.abs(difference);

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

  return {
    isPast,
    times: {
      years,
      days,
      hours,
      minutes,
      seconds,
    },
  };
};

export function timeUntil(
  timestamp: number,
  now = new Date().getTime(),
): string {
  const { isPast, times } = calculateDiff(timestamp, now);

  let result = "";
  Object.entries(times).forEach(([key, value]) => {
    if (value > 0) {
      result += `${value} ${key} `;
    }
  });

  return isPast ? `${result.trim()} ago` : result.trim();
}
