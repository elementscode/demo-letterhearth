import { Job } from "@elements/app";
import { expireCompPlans } from "#app/shared/services/subscribers";

export interface ExpireCompPlansJobFields {}

/**
 * Moves cancelled complimentary plans to free once their period ends.
 */
export class ExpireCompPlansJob extends Job<ExpireCompPlansJobFields> {
  run() {
    expireCompPlans();
  }
}
