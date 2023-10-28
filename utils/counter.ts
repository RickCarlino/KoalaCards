import { register, Counter as C, CounterConfiguration } from "prom-client";

/** It's a counter for Prometheus that's safe for Next.Js
 * hot reloading. */
export function SafeCounter<T extends string>(x: CounterConfiguration<T>) {
  const name = "koala_" + x.name;
  if (!register.getSingleMetric(name)) {
    return new C({
      ...x,
      name
    });
  } else {
    return register.getSingleMetric(name) as C<T>;
  }
}
