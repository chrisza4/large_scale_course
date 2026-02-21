import http from "k6/http";
import { sleep, check } from "k6";

export const options = {
  scenarios: {
    constant_load: {
      executor: "constant-arrival-rate",
      rate: 1000, // 1000 requests per second
      timeUnit: "1s",
      duration: "1m",
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
  },
};

export default function () {
  let res = http.get("https://quickpizza.grafana.com");
  check(res, { "status is 200": (res) => res.status === 200 });
  sleep(0.1);
}
