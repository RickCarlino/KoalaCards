import { register, Counter as C, CounterConfiguration } from "prom-client";

/** It's a counter for Prometheus that's safe for Next.Js
 * hot reloading. */
export function SafeCounter<T extends string>(x: CounterConfiguration<T>) {
  if (!register.getSingleMetric("quiz_completion")) {
    return new C(x);
  } else {
    return register.getSingleMetric("quiz_completion") as C<T>;
  }
}
