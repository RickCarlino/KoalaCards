export function beep(freq = 800, duration = 100) {
  return new Promise((resolve) => {
    var context = new AudioContext();
    var oscillator = context.createOscillator();
    oscillator.type = "sawtooth";
    oscillator.frequency.value = freq;
    oscillator.connect(context.destination);
    oscillator.start();
    setTimeout(function () {
      oscillator.stop();
      resolve(undefined);
    }, duration);
  });
}
